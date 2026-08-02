import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { FinancialLedgerService } from '../src/financial/financial-ledger.service';
import { commerceFixture } from './order-checkout-test.helpers';

describe('Financial domain with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let ledger: FinancialLedgerService;
  let fixture: Awaited<ReturnType<typeof commerceFixture>>;
  let accounts: Awaited<ReturnType<FinancialLedgerService['ensureSellerLedgerAccounts']>>;
  let system: Awaited<ReturnType<FinancialLedgerService['ensureSystemLedgerAccounts']>>;
  const account = (purpose: string) =>
    [...accounts, ...system].find((value) => value.purpose === purpose)!;
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    ledger = app.get(FinancialLedgerService);
  });
  beforeEach(async () => {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    fixture = await commerceFixture(prisma);
    [accounts, system] = await Promise.all([
      ledger.ensureSellerLedgerAccounts(fixture.seller.id),
      ledger.ensureSystemLedgerAccounts(),
    ]);
  });
  afterAll(() => app.close());
  const post = (
    entries: Array<{ accountId: string; direction: 'DEBIT' | 'CREDIT'; amountMinor: bigint }>,
    key = randomUUID(),
    type = 'TEST',
  ) => ledger.post({ type, currency: 'BRL', idempotencyKeyHash: key, entries, emitOutbox: true });
  const fund = (purpose: 'SELLER_PENDING' | 'SELLER_AVAILABLE', amount = 10_000n) =>
    post([
      { accountId: account('PROVIDER_CLEARING').id, direction: 'DEBIT', amountMinor: amount },
      { accountId: account(purpose).id, direction: 'CREDIT', amountMinor: amount },
    ]);
  async function direct(
    entries: Array<{ accountId: string; direction: 'DEBIT' | 'CREDIT'; amountMinor: bigint }>,
    currency = 'BRL',
  ) {
    return prisma.$transaction(async (tx) => {
      const transaction = await tx.ledgerTransaction.create({
        data: {
          type: 'DIRECT',
          currency,
          idempotencyKeyHash: randomUUID(),
          requestHash: randomUUID(),
        },
      });
      for (const entry of entries)
        await tx.ledgerEntry.create({ data: { transactionId: transaction.id, ...entry } });
      return transaction;
    });
  }
  it('persists a balanced posting and derives PENDING/HELD/AVAILABLE/RESERVED', async () => {
    await fund('SELLER_PENDING');
    await post([
      { accountId: account('SELLER_PENDING').id, direction: 'DEBIT', amountMinor: 10_000n },
      { accountId: account('SELLER_HELD').id, direction: 'CREDIT', amountMinor: 10_000n },
    ]);
    await post([
      { accountId: account('SELLER_HELD').id, direction: 'DEBIT', amountMinor: 10_000n },
      { accountId: account('SELLER_AVAILABLE').id, direction: 'CREDIT', amountMinor: 10_000n },
    ]);
    await post([
      { accountId: account('SELLER_AVAILABLE').id, direction: 'DEBIT', amountMinor: 8_000n },
      { accountId: account('SELLER_RESERVED').id, direction: 'CREDIT', amountMinor: 8_000n },
    ]);
    expect(await ledger.getSellerFinancialBalance(fixture.seller.id)).toEqual({
      pending: 0n,
      held: 0n,
      available: 2_000n,
      reserved: 8_000n,
      deficit: 0n,
      currency: 'BRL',
    });
  });
  it('rejects an unbalanced transaction and fewer than two entries in PostgreSQL', async () => {
    await expect(
      direct([
        { accountId: account('PROVIDER_CLEARING').id, direction: 'DEBIT', amountMinor: 10n },
        { accountId: account('SELLER_PENDING').id, direction: 'CREDIT', amountMinor: 9n },
      ]),
    ).rejects.toThrow();
    await expect(
      direct([
        { accountId: account('PROVIDER_CLEARING').id, direction: 'DEBIT', amountMinor: 10n },
      ]),
    ).rejects.toThrow();
  });
  it('rejects currency mismatch in PostgreSQL', async () => {
    const usd = await prisma.ledgerAccount.create({
      data: {
        ownerType: 'SYSTEM',
        ownerId: randomUUID(),
        accountClass: 'ASSET',
        purpose: 'PROVIDER_CLEARING',
        currency: 'USD',
      },
    });
    await expect(
      direct([
        { accountId: usd.id, direction: 'DEBIT', amountMinor: 10n },
        { accountId: account('SELLER_PENDING').id, direction: 'CREDIT', amountMinor: 10n },
      ]),
    ).rejects.toThrow();
  });
  it.each([0n, -1n])('rejects amount %s in PostgreSQL', async (amountMinor) => {
    await expect(
      direct([
        { accountId: account('PROVIDER_CLEARING').id, direction: 'DEBIT', amountMinor },
        { accountId: account('SELLER_PENDING').id, direction: 'CREDIT', amountMinor },
      ]),
    ).rejects.toThrow();
  });
  it('rejects UPDATE and DELETE of LedgerEntry', async () => {
    const transaction = await fund('SELLER_PENDING');
    const id = transaction.entries[0].id;
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "LedgerEntry" SET "amountMinor"=1 WHERE id='${id}'`),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "LedgerEntry" WHERE id='${id}'`),
    ).rejects.toThrow();
  });
  it('rejects UPDATE and DELETE of LedgerTransaction', async () => {
    const transaction = await fund('SELLER_PENDING');
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "LedgerTransaction" SET type='X' WHERE id='${transaction.id}'`,
      ),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "LedgerTransaction" WHERE id='${transaction.id}'`),
    ).rejects.toThrow();
  });
  it('rejects UPDATE and DELETE of FinancialEvent', async () => {
    const transaction = await fund('SELLER_PENDING');
    const event = await prisma.financialEvent.findUniqueOrThrow({
      where: { ledgerTransactionId: transaction.id },
    });
    await expect(
      prisma.$executeRawUnsafe(`UPDATE "FinancialEvent" SET type='X' WHERE id='${event.id}'`),
    ).rejects.toThrow();
    await expect(
      prisma.$executeRawUnsafe(`DELETE FROM "FinancialEvent" WHERE id='${event.id}'`),
    ).rejects.toThrow();
  });
  it('keeps protected buckets non-negative and deficit separate', async () => {
    await expect(
      post([
        { accountId: account('SELLER_AVAILABLE').id, direction: 'DEBIT', amountMinor: 1n },
        { accountId: account('SELLER_RESERVED').id, direction: 'CREDIT', amountMinor: 1n },
      ]),
    ).rejects.toThrow();
    await post([
      { accountId: account('SELLER_DEFICIT').id, direction: 'DEBIT', amountMinor: 500n },
      { accountId: account('PROVIDER_CLEARING').id, direction: 'CREDIT', amountMinor: 500n },
    ]);
    expect(await ledger.getSellerFinancialBalance(fixture.seller.id)).toMatchObject({
      available: 0n,
      deficit: 500n,
    });
  });
  it('provisions seller accounts concurrently without duplicates', async () => {
    await Promise.all(
      Array.from({ length: 8 }, () => ledger.ensureSellerLedgerAccounts(fixture.seller.id)),
    );
    expect(
      await prisma.ledgerAccount.count({ where: { sellerProfileId: fixture.seller.id } }),
    ).toBe(5);
  });
  it('deduplicates identical posting and rejects idempotency reuse with changed payload', async () => {
    const key = randomUUID();
    const entries = [
      { accountId: account('PROVIDER_CLEARING').id, direction: 'DEBIT' as const, amountMinor: 10n },
      { accountId: account('SELLER_PENDING').id, direction: 'CREDIT' as const, amountMinor: 10n },
    ];
    const [first, second] = await Promise.all([post(entries, key), post(entries, key)]);
    expect(first.id).toBe(second.id);
    await expect(
      post(
        entries.map((entry) => ({ ...entry, amountMinor: 11n })),
        key,
      ),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_REUSED' });
  });
  it('allows only one concurrent 8000 reservation from AVAILABLE 10000', async () => {
    await fund('SELLER_AVAILABLE');
    const reserve = () =>
      post([
        { accountId: account('SELLER_AVAILABLE').id, direction: 'DEBIT', amountMinor: 8_000n },
        { accountId: account('SELLER_RESERVED').id, direction: 'CREDIT', amountMinor: 8_000n },
      ]);
    const results = await Promise.allSettled([reserve(), reserve()]);
    expect(results.filter((x) => x.status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect(rejected).toMatchObject({
      status: 'rejected',
      reason: { code: 'INSUFFICIENT_FINANCIAL_BALANCE' },
    });
    expect((rejected as PromiseRejectedResult).reason).not.toMatchObject({ code: 'P2034' });
    expect(await ledger.getSellerFinancialBalance(fixture.seller.id)).toMatchObject({
      available: 2_000n,
      reserved: 8_000n,
    });
  });
  it('rolls back transaction, entries, event and outbox together', async () => {
    const before = await Promise.all([
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.financialEvent.count(),
      prisma.financialOutboxEvent.count(),
    ]);
    await expect(
      prisma.$transaction(async (tx) => {
        const t = await tx.ledgerTransaction.create({
          data: { type: 'ROLLBACK', idempotencyKeyHash: randomUUID(), requestHash: randomUUID() },
        });
        await tx.ledgerEntry.createMany({
          data: [
            {
              transactionId: t.id,
              accountId: account('PROVIDER_CLEARING').id,
              direction: 'DEBIT',
              amountMinor: 1n,
            },
            {
              transactionId: t.id,
              accountId: account('SELLER_PENDING').id,
              direction: 'CREDIT',
              amountMinor: 1n,
            },
          ],
        });
        const e = await tx.financialEvent.create({
          data: { ledgerTransactionId: t.id, type: 'X', aggregateType: 'X', aggregateId: t.id },
        });
        await tx.financialOutboxEvent.create({
          data: { financialEventId: e.id, eventType: 'X', payload: {} },
        });
        throw new Error('ROLLBACK');
      }),
    ).rejects.toThrow('ROLLBACK');
    expect(
      await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.financialEvent.count(),
        prisma.financialOutboxEvent.count(),
      ]),
    ).toEqual(before);
  });
  it('deduplicates webhook replay and provider external IDs', async () => {
    const event = {
      providerCode: 'fake',
      externalEventId: randomUUID(),
      eventType: 'payment',
      payloadHash: randomUUID(),
    };
    await prisma.providerWebhookEvent.create({ data: event });
    await expect(prisma.providerWebhookEvent.create({ data: event })).rejects.toThrow();
    const payment = await createPayment();
    const attempt = {
      paymentId: payment.id,
      attemptNumber: 1,
      providerCode: 'fake',
      method: 'PIX' as const,
      amountMinor: 100n,
      externalPaymentId: randomUUID(),
      idempotencyKeyHash: randomUUID(),
      requestHash: randomUUID(),
    };
    await prisma.paymentAttempt.create({ data: attempt });
    await expect(
      prisma.paymentAttempt.create({
        data: { ...attempt, attemptNumber: 2, idempotencyKeyHash: randomUUID() },
      }),
    ).rejects.toThrow();
  });
  async function createPayment() {
    const cart = await prisma.cart.create({
      data: { buyerUserId: fixture.buyer.id, sellerProfileId: fixture.seller.id },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `T-${randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 100n,
        totalAmountMinor: 100n,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return prisma.payment.create({ data: { orderId: order.id, amountMinor: 100n } });
  }
  it('rejects NOT_CREATED for a real Payment', async () => {
    const payment = await createPayment();
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "Payment" SET status='NOT_CREATED' WHERE id='${payment.id}'`,
      ),
    ).rejects.toThrow();
  });
  it('records compensation without mutating original history', async () => {
    const original = await fund('SELLER_PENDING', 100n);
    const compensation = await post(
      [
        { accountId: account('SELLER_PENDING').id, direction: 'DEBIT', amountMinor: 100n },
        { accountId: account('PROVIDER_CLEARING').id, direction: 'CREDIT', amountMinor: 100n },
      ],
      randomUUID(),
      'COMPENSATION',
    );
    expect(compensation.id).not.toBe(original.id);
    expect(
      await prisma.ledgerTransaction.count({
        where: { id: { in: [original.id, compensation.id] } },
      }),
    ).toBe(2);
  });
  const audit = () => ({ publishedByUserId: fixture.buyer.id, publishedAt: new Date() });
  async function feePolicy(status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'RETIRED' = 'DRAFT') {
    return prisma.feePolicyVersion.create({
      data: {
        publicVersion: Math.floor(Math.random() * 1_000_000_000),
        status,
        effectiveFrom: new Date(Date.now() + Math.floor(Math.random() * 10_000_000)),
        createdByUserId: fixture.buyer.id,
        ...(status === 'DRAFT' ? {} : audit()),
      },
    });
  }
  async function withdrawalPolicy(status: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'RETIRED' = 'DRAFT') {
    return prisma.withdrawalPolicyVersion.create({
      data: {
        publicVersion: Math.floor(Math.random() * 1_000_000_000),
        status,
        effectiveFrom: new Date(Date.now() + Math.floor(Math.random() * 10_000_000)),
        createdByUserId: fixture.buyer.id,
        ...(status === 'DRAFT' ? {} : audit()),
      },
    });
  }
  it('allows every frozen policy lifecycle edge for both policy types', async () => {
    const edges = [
      ['DRAFT', 'SCHEDULED'],
      ['DRAFT', 'ACTIVE'],
      ['DRAFT', 'RETIRED'],
      ['SCHEDULED', 'ACTIVE'],
      ['SCHEDULED', 'RETIRED'],
      ['ACTIVE', 'RETIRED'],
    ] as const;
    for (const [from, to] of edges) {
      const fee = await feePolicy(from);
      const feeAudit =
        from === 'DRAFT'
          ? audit()
          : { publishedByUserId: fee.publishedByUserId, publishedAt: fee.publishedAt };
      const updatedFee = await prisma.feePolicyVersion.update({
        where: { id: fee.id },
        data: { status: to, ...(from === 'DRAFT' ? feeAudit : {}) },
      });
      expect(updatedFee).toMatchObject({ status: to, ...feeAudit });
      const withdrawal = await withdrawalPolicy(from);
      const withdrawalAudit =
        from === 'DRAFT'
          ? audit()
          : {
              publishedByUserId: withdrawal.publishedByUserId,
              publishedAt: withdrawal.publishedAt,
            };
      const updatedWithdrawal = await prisma.withdrawalPolicyVersion.update({
        where: { id: withdrawal.id },
        data: { status: to, ...(from === 'DRAFT' ? withdrawalAudit : {}) },
      });
      expect(updatedWithdrawal).toMatchObject({ status: to, ...withdrawalAudit });
      if (to !== 'RETIRED') {
        await prisma.feePolicyVersion.update({
          where: { id: fee.id },
          data: { status: 'RETIRED' },
        });
        await prisma.withdrawalPolicyVersion.update({
          where: { id: withdrawal.id },
          data: { status: 'RETIRED' },
        });
      }
    }
  });
  it('rejects forbidden policy transitions and historical field mutation', async () => {
    const retired = await feePolicy('RETIRED');
    await expect(
      prisma.feePolicyVersion.update({ where: { id: retired.id }, data: { status: 'ACTIVE' } }),
    ).rejects.toThrow();
    const active = await withdrawalPolicy('ACTIVE');
    await expect(
      prisma.withdrawalPolicyVersion.update({
        where: { id: active.id },
        data: { effectiveFrom: new Date(0) },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.feePolicyVersion.update({
        where: { id: retired.id },
        data: { publishedByUserId: fixture.sellerUser.id },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.withdrawalPolicyVersion.update({
        where: { id: active.id },
        data: { publishedAt: new Date() },
      }),
    ).rejects.toThrow();
  });
  it.each(['Fee', 'Withdrawal'] as const)(
    'allows %s rule CRUD only while parent is DRAFT and blocks INSERT/UPDATE/DELETE after publication',
    async (kind) => {
      if (kind === 'Fee') {
        const draft = await feePolicy();
        const draftRule = await prisma.feeRule.create({
          data: {
            policyVersionId: draft.id,
            category: 'PIX_FEE',
            code: randomUUID(),
            formula: 'FIXED',
            partyCharged: 'BUYER',
            fixedAmountMinor: 1n,
          },
        });
        await prisma.feeRule.update({
          where: { id: draftRule.id },
          data: { fixedAmountMinor: 2n },
        });
        await prisma.feeRule.delete({ where: { id: draftRule.id } });
        for (const status of ['SCHEDULED', 'ACTIVE', 'RETIRED'] as const) {
          const policy = await feePolicy();
          const rule = await prisma.feeRule.create({
            data: {
              policyVersionId: policy.id,
              category: 'PIX_FEE',
              code: randomUUID(),
              formula: 'FIXED',
              partyCharged: 'BUYER',
              fixedAmountMinor: 1n,
            },
          });
          await prisma.feePolicyVersion.update({
            where: { id: policy.id },
            data: { status, ...audit() },
          });
          await expect(
            prisma.feeRule.create({
              data: {
                policyVersionId: policy.id,
                category: 'PIX_FEE',
                code: randomUUID(),
                formula: 'FIXED',
                partyCharged: 'BUYER',
                fixedAmountMinor: 1n,
              },
            }),
          ).rejects.toThrow();
          await expect(
            prisma.feeRule.update({ where: { id: rule.id }, data: { fixedAmountMinor: 3n } }),
          ).rejects.toThrow();
          await expect(prisma.feeRule.delete({ where: { id: rule.id } })).rejects.toThrow();
          const targetDraft = await feePolicy();
          await expect(
            prisma.feeRule.update({
              where: { id: rule.id },
              data: { policyVersionId: targetDraft.id },
            }),
          ).rejects.toThrow();
          if (status !== 'RETIRED')
            await prisma.feePolicyVersion.update({
              where: { id: policy.id },
              data: { status: 'RETIRED' },
            });
        }
      } else {
        const draft = await withdrawalPolicy();
        const draftRule = await prisma.withdrawalPolicyRule.create({
          data: {
            policyVersionId: draft.id,
            speed: 'STANDARD',
            enabled: true,
            slaHours: 48,
            approvalMode: 'MANUAL',
          },
        });
        await prisma.withdrawalPolicyRule.update({
          where: { id: draftRule.id },
          data: { slaHours: 24 },
        });
        await prisma.withdrawalPolicyRule.delete({ where: { id: draftRule.id } });
        for (const status of ['SCHEDULED', 'ACTIVE', 'RETIRED'] as const) {
          const policy = await withdrawalPolicy();
          const rule = await prisma.withdrawalPolicyRule.create({
            data: {
              policyVersionId: policy.id,
              speed: 'STANDARD',
              enabled: true,
              slaHours: 48,
              approvalMode: 'MANUAL',
            },
          });
          await prisma.withdrawalPolicyVersion.update({
            where: { id: policy.id },
            data: { status, ...audit() },
          });
          await expect(
            prisma.withdrawalPolicyRule.create({
              data: {
                policyVersionId: policy.id,
                speed: 'INSTANT',
                enabled: false,
                slaHours: 1,
                approvalMode: 'AUTOMATIC',
              },
            }),
          ).rejects.toThrow();
          await expect(
            prisma.withdrawalPolicyRule.update({ where: { id: rule.id }, data: { slaHours: 12 } }),
          ).rejects.toThrow();
          await expect(
            prisma.withdrawalPolicyRule.delete({ where: { id: rule.id } }),
          ).rejects.toThrow();
          const targetDraft = await withdrawalPolicy();
          await expect(
            prisma.withdrawalPolicyRule.update({
              where: { id: rule.id },
              data: { policyVersionId: targetDraft.id },
            }),
          ).rejects.toThrow();
          if (status !== 'RETIRED')
            await prisma.withdrawalPolicyVersion.update({
              where: { id: policy.id },
              data: { status: 'RETIRED' },
            });
        }
      }
    },
  );
  it('rejects invalid fee formulas and ranges in PostgreSQL', async () => {
    const policy = await feePolicy();
    const base = {
      policyVersionId: policy.id,
      category: 'PIX_FEE' as const,
      partyCharged: 'BUYER' as const,
    };
    await expect(
      prisma.feeRule.create({
        data: { ...base, code: randomUUID(), formula: 'FIXED', fixedAmountMinor: null },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.feeRule.create({
        data: {
          ...base,
          code: randomUUID(),
          formula: 'PERCENT_BPS',
          percentBps: 100,
          fixedAmountMinor: 1n,
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.feeRule.create({
        data: {
          ...base,
          code: randomUUID(),
          formula: 'FIXED',
          fixedAmountMinor: 1n,
          minimumAmountMinor: 5n,
          maximumAmountMinor: 2n,
        },
      }),
    ).rejects.toThrow();
  });
  it('enforces Refund order/requester relations and permits a system requester', async () => {
    const payment = await createPayment();
    const persisted = await prisma.payment.findUniqueOrThrow({
      where: { id: payment.id },
      include: { order: true },
    });
    const base = {
      paymentId: payment.id,
      orderId: persisted.orderId,
      amountMinor: 10n,
      reasonCode: 'SYNTHETIC',
      idempotencyKeyHash: randomUUID(),
      requestHash: randomUUID(),
    };
    await expect(
      prisma.refund.create({ data: { ...base, requestedByUserId: null } }),
    ).resolves.toMatchObject({ orderId: persisted.orderId, requestedByUserId: null });
    await expect(
      prisma.refund.create({
        data: { ...base, idempotencyKeyHash: randomUUID(), orderId: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.refund.create({
        data: { ...base, idempotencyKeyHash: randomUUID(), requestedByUserId: randomUUID() },
      }),
    ).rejects.toThrow();
  });
  it('keeps the immutable Withdrawal request structure tamper-proof', async () => {
    const withdrawal = await prisma.withdrawal.create({
      data: {
        sellerProfileId: fixture.seller.id,
        debitAmountMinor: 100n,
        payoutAmountMinor: 100n,
        slaDueAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
        destinationRef: 'opaque',
        idempotencyKeyHash: randomUUID(),
        requestHash: randomUUID(),
      },
    });
    const mutations = [
      `"sellerProfileId"='${randomUUID()}'`,
      `speed='INSTANT'`,
      `"approvalMode"='AUTOMATIC'`,
      `"debitAmountMinor"=101`,
      `"feeAmountMinor"=1`,
      `"payoutAmountMinor"=99`,
      `currency='USD'`,
      `"slaDueAt"=now()`,
      `"requestedAt"=now()`,
      `"destinationRef"='changed'`,
      `"idempotencyKeyHash"='${randomUUID()}'`,
      `"requestHash"='changed'`,
    ];
    for (const mutation of mutations)
      await expect(
        prisma.$executeRawUnsafe(`UPDATE "Withdrawal" SET ${mutation} WHERE id='${withdrawal.id}'`),
      ).rejects.toThrow();
    await expect(
      prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: { status: 'PENDING_REVIEW', reviewedAt: new Date() },
      }),
    ).resolves.toMatchObject({ status: 'PENDING_REVIEW' });
  });
  it('enforces financial ownership foreign keys and consistency', async () => {
    await expect(
      prisma.paymentProviderAccount.create({
        data: { providerCode: 'fake', owner: 'SELLER', externalAccountId: randomUUID() },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.ledgerAccount.create({
        data: {
          ownerType: 'SELLER',
          ownerId: randomUUID(),
          accountClass: 'LIABILITY',
          purpose: 'SELLER_PENDING',
        },
      }),
    ).rejects.toThrow();
    await expect(
      prisma.paymentProviderAccount.create({
        data: {
          providerCode: 'fake',
          owner: 'SELLER',
          sellerProfileId: randomUUID(),
          externalAccountId: randomUUID(),
        },
      }),
    ).rejects.toThrow();
  });
});
