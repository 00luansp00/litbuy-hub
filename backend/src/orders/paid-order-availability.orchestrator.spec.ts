import { PaidOrderAvailabilityOrchestrator } from './paid-order-availability.orchestrator';

describe('PaidOrderAvailabilityOrchestrator', () => {
  function subject(states: Array<Record<string, string> | null>) {
    const prisma = { order: { findUnique: jest.fn() } };
    states.forEach((state) => prisma.order.findUnique.mockResolvedValueOnce(state));
    const activation = { processOne: jest.fn().mockResolvedValue(false) };
    const fulfillment = { makeAvailable: jest.fn().mockResolvedValue(false) };
    const service = new PaidOrderAvailabilityOrchestrator(
      prisma as never,
      activation as never,
      fulfillment as never,
    );
    return { service, prisma, activation, fulfillment };
  }

  const activePaid = { status: 'ACTIVE', paymentStatus: 'PAID' };
  const available = { ...activePaid, fulfillmentStatus: 'AWAITING_SELLER' };

  it('uses authoritative rereads rather than lossy service booleans', async () => {
    const s = subject([activePaid, available]);
    await expect(s.service.ensureAvailable('order')).resolves.toBeUndefined();
    expect(s.activation.processOne).toHaveBeenCalledWith('order');
    expect(s.fulfillment.makeAvailable).toHaveBeenCalledWith('order');
    expect(s.prisma.order.findUnique).toHaveBeenCalledTimes(2);
  });

  it.each([
    null,
    { status: 'PENDING_PAYMENT', paymentStatus: 'PAID' },
    { status: 'ACTIVE', paymentStatus: 'PENDING' },
  ])('fails closed before fulfillment for incompatible activation state %#', async (state) => {
    const s = subject([state]);
    await expect(s.service.ensureAvailable('order')).rejects.toMatchObject({ status: 409 });
    expect(s.fulfillment.makeAvailable).not.toHaveBeenCalled();
  });

  it.each([
    null,
    { ...activePaid, fulfillmentStatus: 'NOT_AVAILABLE' },
    { status: 'CANCELLED', paymentStatus: 'PAID', fulfillmentStatus: 'AWAITING_SELLER' },
  ])('fails closed unless the final authoritative state is available %#', async (state) => {
    const s = subject([activePaid, state]);
    await expect(s.service.ensureAvailable('order')).rejects.toMatchObject({
      response: { code: 'POST_PAYMENT_AVAILABILITY_REQUIRED' },
    });
  });
});
