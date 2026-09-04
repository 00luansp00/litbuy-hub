import { DisputeFinancialDecisionType } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { DisputeFinancialDecisionService } from './dispute-financial-decision.service';

describe('DisputeFinancialDecisionService', () => {
  const actorUserId = crypto.randomUUID();
  const disputeCaseId = crypto.randomUUID();

  function subject(replay: { requestHash: string; id: string } | null = null) {
    const tx = {
      $queryRaw: jest.fn(),
      disputeFinancialDecision: { findUnique: jest.fn().mockResolvedValue(replay) },
    };
    const prisma = {
      $transaction: jest.fn((work: (client: typeof tx) => unknown) => work(tx)),
    };
    return { service: new DisputeFinancialDecisionService(prisma as never), tx };
  }

  it('rejects invalid idempotency keys before opening a transaction', async () => {
    const { service } = subject();
    await expect(
      service.createPostReleaseBuyerDecision({
        actorUserId,
        disputeCaseId,
        decisionType: DisputeFinancialDecisionType.TOTAL,
        decidedPrincipalAmountMinor: 100n,
        idempotencyKey: 'short',
      }),
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_KEY_INVALID' });
  });

  it('returns the immutable row on an exact replay', async () => {
    const input = {
      actorUserId,
      disputeCaseId,
      decisionType: DisputeFinancialDecisionType.PARTIAL,
      decidedPrincipalAmountMinor: 50n,
      idempotencyKey: 'decision-key-0001',
    } as const;
    const first = subject();
    // Capture the canonical request hash from the first attempt's lookup path.
    first.tx.disputeFinancialDecision.findUnique.mockResolvedValueOnce(null);
    first.tx.$queryRaw.mockResolvedValueOnce([{ locked: 1 }]);
    const actorLookup = { findUnique: jest.fn().mockResolvedValue(null) };
    Object.assign(first.tx, { userRoleAssignment: actorLookup });
    await expect(first.service.createPostReleaseBuyerDecision(input)).rejects.toMatchObject({
      code: 'FINANCIAL_DECISION_ADMIN_REQUIRED',
    });
    expect(first.tx.disputeFinancialDecision.findUnique).toHaveBeenCalledTimes(1);

    const replay = { id: crypto.randomUUID(), requestHash: '' };
    const second = subject(replay);
    second.tx.$queryRaw.mockResolvedValue([{ locked: 1 }]);
    // Use the hash produced by the implementation by importing its stable semantic primitive indirectly.
    const { canonicalRequestHash } = await import('../commerce/idempotency-key');
    replay.requestHash = canonicalRequestHash({
      decidedPrincipalAmountMinor: '50',
      decisionType: 'PARTIAL',
      disputeCaseId,
    });
    await expect(second.service.createPostReleaseBuyerDecision(input)).resolves.toBe(replay);
  });

  it('rejects reuse of a key with different request semantics', async () => {
    const { service, tx } = subject({ id: crypto.randomUUID(), requestHash: 'different' });
    tx.$queryRaw.mockResolvedValue([{ locked: 1 }]);
    await expect(
      service.createPostReleaseBuyerDecision({
        actorUserId,
        disputeCaseId,
        decisionType: DisputeFinancialDecisionType.TOTAL,
        decidedPrincipalAmountMinor: 100n,
        idempotencyKey: 'decision-key-0002',
      }),
    ).rejects.toBeInstanceOf(AppError);
  });
});
