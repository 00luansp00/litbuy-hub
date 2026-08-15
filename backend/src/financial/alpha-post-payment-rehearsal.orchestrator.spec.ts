import { createHash } from 'node:crypto';
import { AlphaPostPaymentRehearsalOrchestrator } from './alpha-post-payment-rehearsal.orchestrator';

describe('AlphaPostPaymentRehearsalOrchestrator', () => {
  const orderId = '00000000-0000-0000-0000-000000000001';
  const expectedKey = createHash('sha256').update(`sale-recognition:v1:${orderId}`).digest('hex');
  const activePaid = {
    status: 'ACTIVE',
    paymentStatus: 'PAID',
    fulfillmentStatus: 'NOT_AVAILABLE',
  };
  const available = { ...activePaid, fulfillmentStatus: 'AWAITING_SELLER' };

  function subject(
    options: {
      states?: Array<Record<string, string> | null>;
      recognitions?: Array<{ idempotencyKeyHash: string }>;
      issue?: { id: string } | null;
      recognitionResult?: boolean;
    } = {},
  ) {
    const prisma = {
      order: { findUnique: jest.fn() },
      ledgerTransaction: {
        findMany: jest
          .fn()
          .mockResolvedValue(options.recognitions ?? [{ idempotencyKeyHash: expectedKey }]),
      },
      reconciliationIssue: { findFirst: jest.fn().mockResolvedValue(options.issue ?? null) },
    };
    for (const state of options.states ?? [activePaid, available])
      prisma.order.findUnique.mockResolvedValueOnce(state);
    const activation = { processOne: jest.fn().mockResolvedValue(false) };
    const recognition = {
      processOne: jest.fn().mockResolvedValue(options.recognitionResult ?? false),
    };
    const fulfillment = { makeAvailable: jest.fn().mockResolvedValue(false) };
    const service = new AlphaPostPaymentRehearsalOrchestrator(
      prisma as never,
      activation as never,
      recognition as never,
      fulfillment as never,
    );
    return { service, prisma, activation, recognition, fulfillment };
  }

  it('orders activation, authoritative recognition validation, and availability', async () => {
    const s = subject();
    await s.service.progress(orderId);
    expect(s.activation.processOne.mock.invocationCallOrder[0]).toBeLessThan(
      s.prisma.order.findUnique.mock.invocationCallOrder[0],
    );
    expect(s.prisma.order.findUnique.mock.invocationCallOrder[0]).toBeLessThan(
      s.recognition.processOne.mock.invocationCallOrder[0],
    );
    expect(s.recognition.processOne.mock.invocationCallOrder[0]).toBeLessThan(
      s.prisma.ledgerTransaction.findMany.mock.invocationCallOrder[0],
    );
    expect(s.prisma.ledgerTransaction.findMany.mock.invocationCallOrder[0]).toBeLessThan(
      s.fulfillment.makeAvailable.mock.invocationCallOrder[0],
    );
    expect(s.prisma.order.findUnique).toHaveBeenCalledTimes(2);
    expect(s.prisma.ledgerTransaction.findMany).toHaveBeenCalledWith({
      where: { type: 'SALE_RECOGNIZED', referenceType: 'OrderSale', referenceId: orderId },
      select: { idempotencyKeyHash: true },
    });
  });

  it.each([
    null,
    { ...activePaid, status: 'PENDING_PAYMENT' },
    { ...activePaid, paymentStatus: 'PENDING' },
  ])('fails closed before recognition when activation does not converge %#', async (state) => {
    const s = subject({ states: [state] });
    await expect(s.service.progress(orderId)).rejects.toMatchObject({ status: 409 });
    expect(s.recognition.processOne).not.toHaveBeenCalled();
    expect(s.fulfillment.makeAvailable).not.toHaveBeenCalled();
  });

  it.each([
    [[]],
    [[{ idempotencyKeyHash: 'wrong' }]],
    [[{ idempotencyKeyHash: expectedKey }, { idempotencyKeyHash: expectedKey }]],
  ])(
    'fails closed before availability for invalid persisted recognition %#',
    async (recognitions) => {
      const s = subject({ recognitions, recognitionResult: true });
      await expect(s.service.progress(orderId)).rejects.toMatchObject({
        response: { code: 'ALPHA_POST_PAYMENT_PROGRESSION_REQUIRED' },
      });
      expect(s.fulfillment.makeAvailable).not.toHaveBeenCalled();
    },
  );

  it('does not trust a true processor result when an active reconciliation exists', async () => {
    const s = subject({ recognitionResult: true, issue: { id: 'issue' } });
    await expect(s.service.progress(orderId)).rejects.toMatchObject({ status: 409 });
    expect(s.prisma.reconciliationIssue.findFirst).toHaveBeenCalledWith({
      where: {
        referenceType: 'SaleFinancialRecognition',
        referenceId: orderId,
        status: { in: ['OPEN', 'INVESTIGATING'] },
      },
      select: { id: true },
    });
    expect(s.fulfillment.makeAvailable).not.toHaveBeenCalled();
  });

  it('replays through an already persisted valid recognition without financial side effects', async () => {
    const s = subject({ recognitionResult: false });
    await expect(s.service.progress(orderId)).resolves.toBeUndefined();
    expect(s.recognition.processOne).toHaveBeenCalledTimes(1);
    expect(s.fulfillment.makeAvailable).toHaveBeenCalledTimes(1);
    expect(Object.keys(s.prisma)).toEqual(['order', 'ledgerTransaction', 'reconciliationIssue']);
  });

  it('validates the final authoritative state', async () => {
    const s = subject({ states: [activePaid, activePaid] });
    await expect(s.service.progress(orderId)).rejects.toMatchObject({ status: 409 });
  });
});
