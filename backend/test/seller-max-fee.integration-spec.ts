import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { commerceFixture, publishPlatformCommissionPolicy } from './order-checkout-test.helpers';

/** I2 economic and policy contract against real PostgreSQL. */
describe('I2 Seller MAX fee checkout', () => {
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

  async function ready(
    sellerPlan: 'STANDARD' | 'LIT_MAX',
    policyOptions: Parameters<typeof publishPlatformCommissionPolicy>[2] = {},
  ) {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
    await prisma.listingDraft.update({
      where: { id: fixture.draft.id },
      data: { requestedSellerPlan: sellerPlan, requestedPromotionTier: 'DIAMOND' },
    });
    await prisma.product.update({
      where: { id: fixture.product.id },
      data: { sellerPlan, listingTier: 'DIAMOND' },
    });
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      publicVersion: 2201,
      percentBps: 1299,
      rule: { promotionTier: 'DIAMOND' },
      ...policyOptions,
    });
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 10,
      expectedVersion: 0,
    });
    return {
      fixture,
      policy,
      dto: {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        buyerVipPlan: 'NONE',
        expectedPreviewFingerprint: preview.buyerVipPreviewFingerprints.NONE,
      },
    };
  }

  const key = () => parseIdempotencyKey(`seller-max-fee:${crypto.randomUUID()}`);

  it('STANDARD needs no MAX rule and snapshots only the Listing Tier', async () => {
    const f = await ready('STANDARD', { includeSellerMaxRule: false });
    const response = await checkout.create(f.fixture.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { feeComponentSnapshots: true },
    });
    expect(order).toMatchObject({
      feeSnapshotVersion: 2,
      sellerPlanSnapshot: 'STANDARD',
      subtotalAmountMinor: 10_000n,
      platformFeeAmountMinor: 1299n,
      totalAmountMinor: 10_000n,
    });
    expect(order.feeComponentSnapshots).toHaveLength(1);
    expect(order.feeComponentSnapshots[0]).toMatchObject({
      componentKind: 'LISTING_TIER',
      feeAmountMinor: 1299n,
    });
  });

  it('LIT_MAX freezes Tier + MAX from one policy and preserves Buyer total', async () => {
    const f = await ready('LIT_MAX');
    const response = await checkout.create(f.fixture.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { feeComponentSnapshots: { orderBy: { componentKind: 'asc' } } },
    });
    const tier = order.feeComponentSnapshots.find((x) => x.componentKind === 'LISTING_TIER')!;
    const max = order.feeComponentSnapshots.find((x) => x.componentKind === 'SELLER_MAX')!;
    expect(order).toMatchObject({
      feeSnapshotVersion: 2,
      sellerPlanSnapshot: 'LIT_MAX',
      subtotalAmountMinor: 10_000n,
      platformFeeAmountMinor: 1598n,
      totalAmountMinor: 10_000n,
    });
    expect(order.totalAmountMinor - order.platformFeeAmountMinor).toBe(8402n);
    expect(order.feeComponentSnapshots).toHaveLength(2);
    expect(tier).toMatchObject({
      percentBps: 1299,
      baseAmountMinor: 10_000n,
      feeAmountMinor: 1299n,
    });
    expect(max).toMatchObject({
      feePolicyVersionId: tier.feePolicyVersionId,
      pricingPolicyVersion: tier.pricingPolicyVersion,
      sellerPlan: 'LIT_MAX',
      listingTier: null,
      category: 'LIT_MAX_PRICE',
      partyCharged: 'SELLER',
      formula: 'PERCENT_BPS',
      percentBps: 299,
      baseAmountMinor: 10_000n,
      feeAmountMinor: 299n,
    });
  });

  it('fails closed for LIT_MAX without an exact sellerPlan rule (wildcard is not MAX)', async () => {
    const f = await ready('LIT_MAX', {
      includeSellerMaxRule: false,
      additionalRules: [{ category: 'LIT_MAX_PRICE', sellerPlan: null, promotionTier: null }],
    });
    await expect(checkout.create(f.fixture.buyer.id, key(), f.dto)).rejects.toMatchObject({
      code: 'SELLER_MAX_FEE_RULE_NOT_FOUND',
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it.each([
    ['party', { partyCharged: 'BUYER' as const }],
    ['formula', { formula: 'FIXED' as const, percentBps: null, fixedAmountMinor: 299n }],
    ['minimum', { minimumAmountMinor: 1n }],
    ['maximum', { maximumAmountMinor: 999n }],
    ['payment qualifier', { paymentMethod: 'PIX' as const }],
    ['promotion tier', { promotionTier: 'DIAMOND' }],
  ])('rejects a non-canonical MAX rule: %s', async (_case, sellerMaxRule) => {
    const f = await ready('LIT_MAX', { sellerMaxRule });
    await expect(checkout.create(f.fixture.buyer.id, key(), f.dto)).rejects.toMatchObject({
      code: 'SELLER_MAX_FEE_RULE_INVALID',
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it.each([
    ['null percent', { percentBps: null }],
    ['fixed amount with percent formula', { fixedAmountMinor: 1n }],
  ])(
    'rejects an invalid FeeRule configuration at the PostgreSQL boundary: %s',
    async (_case, sellerMaxRule) => {
      const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 20, false);
      await expect(
        publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, { sellerMaxRule }),
      ).rejects.toThrow();
    },
  );

  it('fails closed when two exact MAX rules are present', async () => {
    const f = await ready('LIT_MAX', {
      additionalRules: [
        {
          category: 'LIT_MAX_PRICE',
          sellerPlan: 'LIT_MAX',
          promotionTier: null,
          percentBps: 301,
        },
      ],
    });
    await expect(checkout.create(f.fixture.buyer.id, key(), f.dto)).rejects.toMatchObject({
      code: 'SELLER_MAX_FEE_RULE_AMBIGUOUS',
    });
    expect(await prisma.order.count()).toBe(0);
  });

  it('blocks mutation and deletion of a committed MAX component', async () => {
    const f = await ready('LIT_MAX');
    const response = await checkout.create(f.fixture.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { feeComponentSnapshots: true },
    });
    const max = order.feeComponentSnapshots.find((x) => x.componentKind === 'SELLER_MAX')!;
    await expect(
      prisma.orderFeeComponentSnapshot.update({ where: { id: max.id }, data: { percentBps: 300 } }),
    ).rejects.toThrow();
    await expect(
      prisma.orderFeeComponentSnapshot.delete({ where: { id: max.id } }),
    ).rejects.toThrow();
  });
});
