import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DisputeCaseStatus } from '@prisma/client';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { DisputeCoreService } from '../src/disputes/dispute-core.service';
import { commerceFixture } from './order-checkout-test.helpers';

describe('Dispute persistent core (PostgreSQL)', () => {
  jest.setTimeout(120_000);
  let prisma: PrismaService;
  let service: DisputeCoreService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    await module.init();
    prisma = module.get(PrismaService);
    service = module.get(DisputeCoreService);
  });
  beforeEach(async () => prisma.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE'));
  afterAll(async () => prisma.$disconnect());

  async function orderFixture() {
    const fixture = await commerceFixture(prisma);
    const cart = await prisma.cart.create({
      data: { buyerUserId: fixture.buyer.id, sellerProfileId: fixture.seller.id },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `DSP-${crypto.randomUUID()}`,
        sourceCartId: cart.id,
        sourceCartVersion: cart.version,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    return { ...fixture, order };
  }

  it('persists the Order relation and DB-materialized initial audit event', async () => {
    const { order, buyer } = await orderFixture();
    const created = await service.createCase({ orderId: order.id, actorUserId: buyer.id });
    expect(created).toMatchObject({ orderId: order.id, status: 'OPEN' });
    expect(created.events).toEqual([
      expect.objectContaining({ orderId: order.id, type: 'CASE_OPENED', toStatus: 'OPEN' }),
    ]);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).disputeStatus).toBe(
      'NONE',
    );
  });

  it('uses PostgreSQL uniqueness as the real concurrency backstop', async () => {
    const { order } = await orderFixture();
    const results = await Promise.allSettled([
      service.createCase({ orderId: order.id }),
      service.createCase({ orderId: order.id }),
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.disputeCase.count({ where: { orderId: order.id, status: 'OPEN' } })).toBe(
      1,
    );
    await expect(prisma.disputeCase.create({ data: { orderId: order.id } })).rejects.toMatchObject({
      code: 'P2002',
    });
  });

  it('retains terminal history and permits a later active case', async () => {
    const { order, buyer } = await orderFixture();
    const first = await service.createCase({ orderId: order.id, actorUserId: buyer.id });
    await service.transition({
      caseId: first.id,
      toStatus: DisputeCaseStatus.UNDER_REVIEW,
      actorUserId: buyer.id,
    });
    const terminal = await service.transition({
      caseId: first.id,
      toStatus: DisputeCaseStatus.RESOLVED_BUYER,
      actorUserId: buyer.id,
    });
    expect(terminal.terminalAt).not.toBeNull();
    expect(terminal.events.map((event) => event.toStatus)).toEqual([
      'OPEN',
      'UNDER_REVIEW',
      'RESOLVED_BUYER',
    ]);
    const second = await service.createCase({ orderId: order.id });
    expect(second.id).not.toBe(first.id);
    expect(await prisma.disputeCase.count({ where: { orderId: order.id } })).toBe(2);
  });

  it('fails closed for invalid/FK writes and prevents destructive history mutation', async () => {
    const { order } = await orderFixture();
    await expect(service.createCase({ orderId: crypto.randomUUID() })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    const dispute = await service.createCase({ orderId: order.id });
    await expect(
      service.transition({ caseId: dispute.id, toStatus: DisputeCaseStatus.OPEN }),
    ).rejects.toBeInstanceOf(BadRequestException);
    await prisma.$executeRawUnsafe(
      'UPDATE "DisputeCase" SET status = \'CLOSED\' WHERE id = $1::uuid',
      dispute.id,
    );
    const event = await prisma.disputeCaseEvent.findFirstOrThrow({
      where: { disputeCaseId: dispute.id },
    });
    await expect(
      prisma.disputeCaseEvent.update({ where: { id: event.id }, data: { actorUserId: null } }),
    ).rejects.toBeDefined();
    await expect(prisma.disputeCaseEvent.delete({ where: { id: event.id } })).rejects.toBeDefined();
    await expect(prisma.disputeCase.delete({ where: { id: dispute.id } })).rejects.toBeDefined();
  });

  it('does not mutate Ledger, holds, release, refunds, or recovery', async () => {
    const { order } = await orderFixture();
    const before = [
      await prisma.ledgerTransaction.count(),
      await prisma.financialHold.count(),
      await prisma.refund.count(),
    ];
    const dispute = await service.createCase({ orderId: order.id });
    await service.transition({ caseId: dispute.id, toStatus: DisputeCaseStatus.CLOSED });
    expect([
      await prisma.ledgerTransaction.count(),
      await prisma.financialHold.count(),
      await prisma.refund.count(),
    ]).toEqual(before);
  });
});
