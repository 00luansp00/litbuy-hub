import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

describe('PR #47 platform commission snapshot with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());

  const key = () => parseIdempotencyKey(`commission:${crypto.randomUUID()}`);
  async function ready(policyOptions: Parameters<typeof publishPlatformCommissionPolicy>[2] = {}) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const policy = await publishPlatformCommissionPolicy(
      prisma,
      fixture.sellerUser.id,
      policyOptions,
    );
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    return {
      ...fixture,
      preview,
      dto: {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
      policy,
    };
  }

  it.each([
    ['FIXED', null, 125n, null, null, 125n],
    ['PERCENT_BPS', 1251, null, null, null, 125n],
    ['PERCENT_BPS_PLUS_FIXED', 1000, 25n, null, null, 125n],
    ['PERCENT_BPS', 100, null, 50n, null, 50n],
    ['PERCENT_BPS', 9000, null, null, 250n, 250n],
    ['FIXED', null, 0n, null, null, 0n],
  ] as const)(
    'snapshots %s commission with deterministic limits',
    async (formula, percentBps, fixedAmountMinor, minimumAmountMinor, maximumAmountMinor, fee) => {
      const f = await ready({
        formula,
        percentBps,
        fixedAmountMinor,
        minimumAmountMinor,
        maximumAmountMinor,
      });
      const rule = f.policy.rules[0];
      const response = await checkout.create(f.buyer.id, key(), f.dto);
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicCode: (response as { orderCode: string }).orderCode },
        include: { items: true },
      });
      expect(order).toMatchObject({
        feePolicyVersionId: f.policy.id,
        platformCommissionRuleId: rule.id,
        pricingPolicyVersion: f.policy.publicVersion,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        platformFeeAmountMinor: fee,
      });
      expect(
        order.items.every((item) => item.pricingPolicyVersion === f.policy.publicVersion),
      ).toBe(true);
      expect((response as { platformFeeAmountMinor: string }).platformFeeAmountMinor).toBe(
        fee.toString(),
      );
    },
  );

  it.each([
    ['draft policy', { status: 'DRAFT' }, 'FEE_POLICY_NOT_FOUND'],
    [
      'scheduled policy',
      { status: 'SCHEDULED', effectiveFrom: new Date(Date.now() + 60_000) },
      'FEE_POLICY_NOT_FOUND',
    ],
    ['retired policy', { status: 'RETIRED' }, 'FEE_POLICY_NOT_FOUND'],
    ['expired policy', { effectiveTo: new Date(Date.now() - 1) }, 'FEE_POLICY_NOT_FOUND'],
    ['no commission rule', { rule: { category: 'OTHER' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    ['buyer rule', { rule: { partyCharged: 'BUYER' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    ['platform rule', { rule: { partyCharged: 'PLATFORM' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    ['disabled rule', { rule: { enabled: false } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    ['payment qualifier', { rule: { paymentMethod: 'PIX' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    [
      'installments qualifier',
      { rule: { installmentsFrom: 1 } },
      'PLATFORM_COMMISSION_RULE_NOT_FOUND',
    ],
    [
      'seller level qualifier',
      { rule: { sellerLevel: 'GOLD' } },
      'PLATFORM_COMMISSION_RULE_NOT_FOUND',
    ],
    [
      'seller plan qualifier',
      { rule: { sellerPlan: 'PRO' } },
      'PLATFORM_COMMISSION_RULE_NOT_FOUND',
    ],
    ['promotion qualifier', { rule: { promotionTier: 'A' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
    [
      'withdrawal qualifier',
      { rule: { withdrawalSpeed: 'STANDARD' } },
      'PLATFORM_COMMISSION_RULE_NOT_FOUND',
    ],
    ['product qualifier', { rule: { productType: 'GAME' } }, 'PLATFORM_COMMISSION_RULE_NOT_FOUND'],
  ] as const)(
    'fails closed for %s and rolls back commerce effects',
    async (_name, options, code) => {
      const f = await ready(options);
      const before = await Promise.all([
        prisma.inventoryReservation.count(),
        prisma.orderEvent.count(),
        prisma.outboxEvent.count(),
      ]);
      await expect(checkout.create(f.buyer.id, key(), f.dto)).rejects.toMatchObject({ code });
      expect(await prisma.order.count()).toBe(0);
      expect(
        await Promise.all([
          prisma.inventoryReservation.count(),
          prisma.orderEvent.count(),
          prisma.outboxEvent.count(),
        ]),
      ).toEqual(before);
      expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.preview.id } })).toMatchObject({
        status: 'ACTIVE',
      });
    },
  );

  it('fails closed when no policy exists', async () => {
    const f = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const preview = await carts.add(f.buyer.id, f.seller.slug, {
      productId: f.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    await expect(
      checkout.create(f.buyer.id, key(), {
        sellerSlug: f.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      }),
    ).rejects.toMatchObject({ code: 'FEE_POLICY_NOT_FOUND' });
    expect(await prisma.order.count()).toBe(0);
  });

  it('uses priority, rejects a real tie, and rejects a fee above the order total', async () => {
    const f = await ready({
      fixedAmountMinor: 100n,
      rule: { priority: 1 },
      additionalRules: [{ code: 'higher', fixedAmountMinor: 200n, priority: 2 }],
    });
    const winner = f.policy.rules.find((rule) => rule.code === 'higher');
    const result = await checkout.create(f.buyer.id, key(), f.dto);
    expect(
      await prisma.order.findUniqueOrThrow({
        where: { publicCode: (result as { orderCode: string }).orderCode },
      }),
    ).toMatchObject({ platformCommissionRuleId: winner?.id, platformFeeAmountMinor: 200n });

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const tied = await ready({
      additionalRules: [{ code: 'tie', fixedAmountMinor: 0n }],
    });
    await expect(checkout.create(tied.buyer.id, key(), tied.dto)).rejects.toMatchObject({
      code: 'FEE_RULE_AMBIGUOUS',
    });

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const excessive = await ready({ fixedAmountMinor: 1001n });
    await expect(checkout.create(excessive.buyer.id, key(), excessive.dto)).rejects.toMatchObject({
      code: 'PLATFORM_COMMISSION_EXCEEDS_ORDER_TOTAL',
    });
  });

  it('freezes the first order and replay while a later checkout uses a new policy', async () => {
    const first = await ready({ fixedAmountMinor: 100n });
    const replayKey = key();
    const firstResponse = await checkout.create(first.buyer.id, replayKey, first.dto);
    await prisma.feePolicyVersion.update({
      where: { id: first.policy.id },
      data: { status: 'RETIRED' },
    });
    const secondPolicy = await publishPlatformCommissionPolicy(prisma, first.sellerUser.id, {
      publicVersion: 2,
      formula: 'FIXED',
      fixedAmountMinor: 200n,
    });
    expect(await checkout.create(first.buyer.id, replayKey, first.dto)).toEqual(firstResponse);
    const second = await commerceFixture(prisma);
    const preview = await carts.add(second.buyer.id, second.seller.slug, {
      productId: second.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const secondResponse = await checkout.create(second.buyer.id, key(), {
      sellerSlug: second.seller.slug,
      expectedCartVersion: preview.version,
      expectedPreviewFingerprint: preview.previewFingerprint,
    });
    const orders = await prisma.order.findMany({ orderBy: { createdAt: 'asc' } });
    expect(orders[0]).toMatchObject({
      feePolicyVersionId: first.policy.id,
      platformFeeAmountMinor: 100n,
    });
    expect(orders[1]).toMatchObject({
      feePolicyVersionId: secondPolicy.id,
      platformFeeAmountMinor: 200n,
    });
    expect((secondResponse as { platformFeeAmountMinor: string }).platformFeeAmountMinor).toBe(
      '200',
    );
    await expect(
      prisma.feePolicyVersion.delete({ where: { id: first.policy.id } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.feeRule.delete({ where: { id: first.policy.rules[0].id } }),
    ).rejects.toBeDefined();
  });

  it('enforces database fee constraints and creates no financial records', async () => {
    const f = await ready();
    const result = await checkout.create(f.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (result as { orderCode: string }).orderCode },
    });
    for (const fee of [-1n, 1001n])
      await expect(
        prisma.order.update({ where: { id: order.id }, data: { platformFeeAmountMinor: fee } }),
      ).rejects.toBeDefined();
    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: { totalAmountMinor: 0n, platformFeeAmountMinor: 1n },
      }),
    ).rejects.toBeDefined();
    expect(
      await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.financialEvent.count(),
        prisma.settlement.count(),
        prisma.financialHold.count(),
      ]),
    ).toEqual([0, 0, 0, 0, 0]);
  });
});
