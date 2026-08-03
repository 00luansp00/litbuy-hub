import { Inject, Injectable } from '@nestjs/common';
import {
  PaymentProviderError,
  type PaymentProviderNotificationPort,
  type ProviderWebhook,
} from './payment-provider.port';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { ProviderNotificationProtector } from './provider-notification-protector';

export const PAYMENT_NOTIFICATION_PROVIDERS = Symbol('PAYMENT_NOTIFICATION_PROVIDERS');

type ClaimedInbox = {
  id: string;
  providerCode: string;
  contentType: string;
  attempts: number;
  protectedKeyId: string;
  protectedVersion: number;
  protectedIv: Buffer;
  protectedCiphertext: Buffer;
  protectedAuthTag: Buffer;
};

@Injectable()
export class ProviderNotificationInboxWorker {
  private readonly providers: Map<string, PaymentProviderNotificationPort>;
  constructor(
    private readonly prisma: PrismaService,
    private readonly protector: ProviderNotificationProtector,
    @Inject(PAYMENT_NOTIFICATION_PROVIDERS)
    providers: PaymentProviderNotificationPort[],
  ) {
    this.providers = new Map(providers.map((provider) => [provider.providerCode, provider]));
  }

  async processOne(): Promise<boolean> {
    const inbox = await this.claimOne();
    if (!inbox) return false;
    const provider = this.providers.get(inbox.providerCode);
    if (!provider) {
      await this.fail(inbox, 'PROVIDER_NOT_CONFIGURED');
      return true;
    }
    try {
      provider.assertAvailable();
      const token = this.protector.recover(inbox);
      const events = await provider.resolveNotification({
        payload: Buffer.from(`notification=${encodeURIComponent(token)}`),
        contentType: 'application/x-www-form-urlencoded',
        transportVerified: true,
      });
      try {
        await this.complete(inbox, events);
      } catch {
        await this.scheduleRetry(inbox, 'LOCAL_FINALIZATION_FAILED');
      }
    } catch (error) {
      await this.handleFailure(inbox, error);
    }
    return true;
  }

  async processBatch(limit = 25): Promise<number> {
    let processed = 0;
    const bounded = Math.max(1, Math.min(limit, 100));
    while (processed < bounded && (await this.processOne())) processed += 1;
    return processed;
  }

  private async claimOne(): Promise<ClaimedInbox | null> {
    return this.prisma.$transaction(async (tx) => {
      const rows = await tx.$queryRaw<ClaimedInbox[]>`
        WITH candidate AS (
          SELECT "id"
          FROM "ProviderNotificationInbox"
          WHERE (
            ("status" IN ('PENDING', 'RETRY_SCHEDULED') AND "availableAt" <= NOW())
            OR ("status" = 'PROCESSING' AND "processingStartedAt" < NOW() - INTERVAL '5 minutes')
          )
          ORDER BY "availableAt", "receivedAt", "id"
          FOR UPDATE SKIP LOCKED
          LIMIT 1
        )
        UPDATE "ProviderNotificationInbox" inbox
        SET "status" = 'PROCESSING',
            "attempts" = inbox."attempts" + 1,
            "processingStartedAt" = NOW(),
            "lastErrorCode" = NULL,
            "updatedAt" = NOW()
        FROM candidate
        WHERE inbox."id" = candidate."id"
        RETURNING inbox."id", inbox."providerCode", inbox."contentType", inbox."attempts",
          inbox."protectedKeyId", inbox."protectedVersion", inbox."protectedIv",
          inbox."protectedCiphertext", inbox."protectedAuthTag"
      `;
      return rows[0] ?? null;
    });
  }

  private async complete(inbox: ClaimedInbox, events: ProviderWebhook[]): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockCurrentClaim(tx, inbox))) return;
      for (const event of [...events].sort((a, b) =>
        a.externalEventId.localeCompare(b.externalEventId),
      ))
        await acquireAdvisoryTransactionLock(
          tx,
          `provider-event:${inbox.providerCode}:${event.externalEventId}`,
        );

      const inspected = await Promise.all(
        events.map(async (event) => ({
          event,
          existing: await tx.providerWebhookEvent.findUnique({
            where: {
              providerCode_externalEventId: {
                providerCode: inbox.providerCode,
                externalEventId: event.externalEventId,
              },
            },
          }),
        })),
      );
      const conflict = inspected.find(
        ({ event, existing }) => existing && !sameEvent(existing, event),
      );
      if (conflict) {
        await tx.reconciliationIssue.create({
          data: {
            providerCode: inbox.providerCode,
            type: 'DUPLICATE_EXTERNAL_EVENT',
            referenceType: 'ProviderNotificationInbox',
            referenceId: inbox.id,
            details: { externalEventId: conflict.event.externalEventId },
          },
        });
        await tx.providerNotificationInbox.update({
          where: { id: inbox.id },
          data: {
            status: 'RECONCILIATION_REQUIRED',
            lastErrorCode: 'INCOMPATIBLE_EXTERNAL_EVENT',
          },
        });
        return;
      }
      for (const { event, existing } of inspected) {
        if (!existing) {
          await tx.providerWebhookEvent.create({
            data: {
              providerCode: inbox.providerCode,
              externalEventId: event.externalEventId,
              eventType: event.type,
              externalPaymentId: event.paymentId,
              normalizedPaymentStatus: event.status,
              occurredAt: event.occurredAt,
              payloadHash: event.payloadHash,
            },
          });
        }
      }
      await tx.providerNotificationInbox.update({
        where: { id: inbox.id },
        data: { status: 'PROCESSED', processedAt: new Date(), lastErrorCode: null },
      });
    });
  }

  private async handleFailure(inbox: ClaimedInbox, error: unknown): Promise<void> {
    if (error instanceof PaymentProviderError && error.kind === 'SAFE_TO_RETRY') {
      await this.scheduleRetry(inbox, sanitizeCode(error.reason));
      return;
    }
    if (error instanceof PaymentProviderError && error.requiresReconciliation) {
      await this.prisma.$transaction(async (tx) => {
        if (!(await lockCurrentClaim(tx, inbox))) return;
        await tx.reconciliationIssue.create({
          data: {
            providerCode: inbox.providerCode,
            type: 'OTHER',
            referenceType: 'ProviderNotificationInbox',
            referenceId: inbox.id,
            details: { errorCode: sanitizeCode(error.reason) },
          },
        });
        await tx.providerNotificationInbox.update({
          where: { id: inbox.id },
          data: {
            status: 'RECONCILIATION_REQUIRED',
            lastErrorCode: sanitizeCode(error.reason),
          },
        });
      });
      return;
    }
    const code =
      error instanceof PaymentProviderError ? error.reason : 'NOTIFICATION_PROCESSING_FAILED';
    await this.fail(inbox, sanitizeCode(code));
  }

  private async scheduleRetry(inbox: ClaimedInbox, code: string): Promise<void> {
    const delaySeconds = Math.min(300, 2 ** Math.min(inbox.attempts, 8));
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockCurrentClaim(tx, inbox))) return;
      await tx.providerNotificationInbox.update({
        where: { id: inbox.id },
        data: {
          status: 'RETRY_SCHEDULED',
          availableAt: new Date(Date.now() + delaySeconds * 1_000),
          lastErrorCode: code,
        },
      });
    });
  }

  private async fail(inbox: ClaimedInbox, code: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      if (!(await lockCurrentClaim(tx, inbox))) return;
      await tx.providerNotificationInbox.update({
        where: { id: inbox.id },
        data: { status: 'FAILED', lastErrorCode: code },
      });
    });
  }
}

async function lockCurrentClaim(
  tx: Prisma.TransactionClient,
  inbox: Pick<ClaimedInbox, 'id' | 'attempts'>,
): Promise<boolean> {
  const rows = await tx.$queryRaw<Array<{ current: boolean }>>`
    SELECT ("status" = 'PROCESSING' AND "attempts" = ${inbox.attempts}) AS current
    FROM "ProviderNotificationInbox"
    WHERE "id" = ${inbox.id}::uuid
    FOR UPDATE
  `;
  return rows[0]?.current === true;
}

function sameEvent(
  existing: {
    eventType: string;
    externalPaymentId: string;
    normalizedPaymentStatus: string;
    occurredAt: Date | null;
    payloadHash: string;
  },
  event: ProviderWebhook,
): boolean {
  return (
    existing.eventType === event.type &&
    existing.externalPaymentId === event.paymentId &&
    existing.normalizedPaymentStatus === event.status &&
    existing.payloadHash === event.payloadHash &&
    (existing.occurredAt?.getTime() ?? null) === (event.occurredAt?.getTime() ?? null)
  );
}

function sanitizeCode(code: string): string {
  return /^[A-Z0-9_]{1,64}$/.test(code) ? code : 'NOTIFICATION_PROCESSING_FAILED';
}
