import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { ListingTierPolicyService } from '../src/financial/listing-tier-policy.service';
import {
  commerceFixture,
  publishPlatformCommissionPolicy,
  publishSellerReleasePolicy,
} from './order-checkout-test.helpers';

describe('PR #47 platform commission snapshot with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;
  let listingTierPolicy: ListingTierPolicyService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    listingTierPolicy = app.get(ListingTierPolicyService);
  });
  async function cleanup() {
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  }

  beforeEach(async () => {
    await cleanup();
    expect(await prisma.feePolicyVersion.count({ where: { status: 'ACTIVE' } })).toBe(0);
  });

  afterEach(cleanup);
  afterAll(() => app.close());

  const key = () => parseIdempotencyKey(`commission:${crypto.randomUUID()}`);
  async function ready(
    policyOptions: Parameters<typeof publishPlatformCommissionPolicy>[2] = {},
    tier: 'SILVER' | 'GOLD' | 'DIAMOND' = 'SILVER',
    quantity = 1,
  ) {
    const fixture = await commerceFixture(
      prisma,
      'NORMAL',
      undefined,
      Math.max(5, quantity),
      false,
    );
    await prisma.listingDraft.update({
      where: { id: fixture.draft.id },
      data: { requestedPromotionTier: tier },
    });
    await prisma.product.update({ where: { id: fixture.product.id }, data: { listingTier: tier } });
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      ...policyOptions,
      rule: { promotionTier: tier, ...policyOptions.rule },
    });
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity,
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
    ['SILVER', 731, 731n],
    ['GOLD', 842, 842n],
    ['DIAMOND', 953, 953n],
  ] as const)(
    'snapshots the exact %s listing tier commission without increasing Buyer total',
    async (tier, percentBps, fee) => {
      const f = await ready({ percentBps }, tier, 10);
      const rule = f.policy.rules[0];
      const response = await checkout.create(f.buyer.id, key(), f.dto);
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicCode: (response as { orderCode: string }).orderCode },
        include: { items: true, feeComponentSnapshots: true },
      });
      expect(order).toMatchObject({
        feePolicyVersionId: f.policy.id,
        platformCommissionRuleId: rule.id,
        pricingPolicyVersion: f.policy.publicVersion,
        subtotalAmountMinor: 10_000n,
        totalAmountMinor: 10_000n,
        platformFeeAmountMinor: fee,
        feeSnapshotVersion: 1,
      });
      expect(order.feeComponentSnapshots).toEqual([
        expect.objectContaining({
          orderId: order.id,
          componentKind: 'LISTING_TIER',
          feePolicyVersionId: f.policy.id,
          feeRuleId: rule.id,
          pricingPolicyVersion: f.policy.publicVersion,
          listingTier: tier,
          category: 'PLATFORM_COMMISSION',
          partyCharged: 'SELLER',
          formula: 'PERCENT_BPS',
          percentBps,
          baseAmountMinor: 10_000n,
          feeAmountMinor: fee,
          currency: 'BRL',
        }),
      ]);
      expect(
        order.items.every((item) => item.pricingPolicyVersion === f.policy.publicVersion),
      ).toBe(true);
      expect((response as { platformFeeAmountMinor: string }).platformFeeAmountMinor).toBe(
        fee.toString(),
      );
    },
  );

  it('materializes an explicit zero-bps component instead of treating absence as zero', async () => {
    const f = await ready({ percentBps: 0 }, 'SILVER', 2);
    const response = await checkout.create(f.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (response as { orderCode: string }).orderCode },
      include: { feeComponentSnapshots: true },
    });
    expect(order.platformFeeAmountMinor).toBe(0n);
    expect(order.feeComponentSnapshots).toEqual([
      expect.objectContaining({ percentBps: 0, baseAmountMinor: 2_000n, feeAmountMinor: 0n }),
    ]);
  });

  it.each([
    ['draft policy', { status: 'DRAFT' }, 'FEE_POLICY_NOT_FOUND'],
    [
      'scheduled policy',
      { status: 'SCHEDULED', effectiveFrom: new Date(Date.now() + 60_000) },
      'FEE_POLICY_NOT_FOUND',
    ],
    ['retired policy', { status: 'RETIRED' }, 'FEE_POLICY_NOT_FOUND'],
    ['expired policy', { effectiveTo: new Date(Date.now() - 1) }, 'FEE_POLICY_NOT_FOUND'],
    ['no commission rule', { rule: { category: 'OTHER' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['buyer rule', { rule: { partyCharged: 'BUYER' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['platform rule', { rule: { partyCharged: 'PLATFORM' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['disabled rule', { rule: { enabled: false } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['wildcard rule', { rule: { promotionTier: null } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['fixed rule', { formula: 'FIXED', fixedAmountMinor: 1n }, 'LISTING_TIER_FEE_RULE_INVALID'],
    [
      'plus fixed rule',
      { formula: 'PERCENT_BPS_PLUS_FIXED', percentBps: 1, fixedAmountMinor: 1n },
      'LISTING_TIER_FEE_RULE_INVALID',
    ],
    ['minimum', { minimumAmountMinor: 1n }, 'LISTING_TIER_FEE_RULE_INVALID'],
    ['maximum', { maximumAmountMinor: 1n }, 'LISTING_TIER_FEE_RULE_INVALID'],
    ['payment qualifier', { rule: { paymentMethod: 'PIX' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    [
      'installments qualifier',
      { rule: { installmentsFrom: 1 } },
      'LISTING_TIER_FEE_RULE_NOT_FOUND',
    ],
    [
      'seller level qualifier',
      { rule: { sellerLevel: 'GOLD' } },
      'LISTING_TIER_FEE_RULE_NOT_FOUND',
    ],
    ['seller plan qualifier', { rule: { sellerPlan: 'PRO' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    ['other tier', { rule: { promotionTier: 'GOLD' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
    [
      'withdrawal qualifier',
      { rule: { withdrawalSpeed: 'STANDARD' } },
      'LISTING_TIER_FEE_RULE_NOT_FOUND',
    ],
    ['product qualifier', { rule: { productType: 'GAME' } }, 'LISTING_TIER_FEE_RULE_NOT_FOUND'],
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

  it('rejects ambiguous exact rules and a percentage fee above the order total', async () => {
    const tied = await ready({
      additionalRules: [{ code: 'tie', percentBps: 999 }],
    });
    await expect(checkout.create(tied.buyer.id, key(), tied.dto)).rejects.toMatchObject({
      code: 'FEE_RULE_AMBIGUOUS',
    });

    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    const excessive = await ready({ percentBps: 10_010 });
    await expect(checkout.create(excessive.buyer.id, key(), excessive.dto)).rejects.toMatchObject({
      code: 'PLATFORM_COMMISSION_EXCEEDS_ORDER_TOTAL',
    });
  });

  it('freezes the first order and replay while a later checkout uses a new policy', async () => {
    const first = await ready({ percentBps: 1000 });
    const replayKey = key();
    const firstResponse = await checkout.create(first.buyer.id, replayKey, first.dto);
    const firstReleasePolicy = await prisma.sellerReleasePolicyVersion.findFirstOrThrow({
      where: { status: 'ACTIVE' },
    });
    await prisma.feePolicyVersion.update({
      where: { id: first.policy.id },
      data: { status: 'RETIRED' },
    });
    const secondPolicy = await publishPlatformCommissionPolicy(prisma, first.sellerUser.id, {
      publicVersion: 2,
      percentBps: 2000,
    });
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: firstReleasePolicy.id },
      data: { status: 'RETIRED' },
    });
    const secondReleasePolicy = await publishSellerReleasePolicy(prisma, first.sellerUser.id, 24);
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
    const orders = await prisma.order.findMany({
      orderBy: { createdAt: 'asc' },
      include: { feeComponentSnapshots: true },
    });
    expect(orders[0]).toMatchObject({
      feePolicyVersionId: first.policy.id,
      platformFeeAmountMinor: 100n,
      sellerReleasePolicyVersionId: firstReleasePolicy.id,
    });
    expect(orders[1]).toMatchObject({
      feePolicyVersionId: secondPolicy.id,
      platformFeeAmountMinor: 200n,
      sellerReleasePolicyVersionId: secondReleasePolicy.id,
      frozenBaseReleaseDelayHours: 24,
    });
    expect((secondResponse as { platformFeeAmountMinor: string }).platformFeeAmountMinor).toBe(
      '200',
    );
    expect(orders[0].feeComponentSnapshots).toEqual([
      expect.objectContaining({
        feePolicyVersionId: first.policy.id,
        percentBps: 1000,
        feeAmountMinor: 100n,
      }),
    ]);
    expect(orders[1].feeComponentSnapshots).toEqual([
      expect.objectContaining({
        feePolicyVersionId: secondPolicy.id,
        percentBps: 2000,
        feeAmountMinor: 200n,
      }),
    ]);
    await expect(
      prisma.feePolicyVersion.delete({ where: { id: first.policy.id } }),
    ).rejects.toBeDefined();
    await expect(
      prisma.feeRule.delete({ where: { id: first.policy.rules[0].id } }),
    ).rejects.toBeDefined();
  });

  async function financialCounts() {
    return Promise.all([
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.financialEvent.count(),
      prisma.financialOutboxEvent.count(),
      prisma.settlement.count(),
      prisma.financialHold.count(),
    ]);
  }

  it('enforces database fee constraints and creates no financial records', async () => {
    const f = await ready({ percentBps: 1250 });
    const beforeFinancial = await financialCounts();
    const result = await checkout.create(f.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (result as { orderCode: string }).orderCode },
    });
    expect(order).toMatchObject({
      subtotalAmountMinor: 1000n,
      discountAmountMinor: 0n,
      platformFeeAmountMinor: 125n,
      totalAmountMinor: 1000n,
    });
    for (const fee of [-1n, 1001n])
      await expect(
        prisma.order.update({ where: { id: order.id }, data: { platformFeeAmountMinor: fee } }),
      ).rejects.toBeDefined();
    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: { totalAmountMinor: 1125n },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: { totalAmountMinor: 0n, platformFeeAmountMinor: 1n },
      }),
    ).rejects.toBeDefined();
    expect(await financialCounts()).toEqual(beforeFinancial);
  });

  async function expectImmutable(promise: Promise<unknown>) {
    await expect(promise).rejects.toMatchObject({
      message: expect.stringContaining('ORDER_PRICING_SNAPSHOT_IMMUTABLE'),
    });
  }

  async function createCartShell(fixture: Awaited<ReturnType<typeof commerceFixture>>) {
    const buyer = await prisma.user.create({
      data: {
        email: `legacy-buyer-${crypto.randomUUID()}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
        roleAssignments: { create: { role: 'BUYER' } },
      },
    });
    return prisma.cart.create({
      data: { buyerUserId: buyer.id, sellerProfileId: fixture.seller.id },
    });
  }

  async function createOrderShell(
    fixture: Awaited<ReturnType<typeof commerceFixture>>,
    cartId: string,
    cartVersion: number,
    data: {
      feePolicyVersionId?: string | null;
      platformCommissionRuleId?: string | null;
      pricingPolicyVersion?: number;
      platformFeeAmountMinor?: bigint;
    } = {},
  ) {
    return prisma.order.create({
      data: {
        publicCode: `legacy-${crypto.randomUUID()}`,
        sourceCartId: cartId,
        sourceCartVersion: cartVersion,
        buyerUserId: fixture.buyer.id,
        sellerProfileId: fixture.seller.id,
        currency: 'BRL',
        subtotalAmountMinor: 1000n,
        discountAmountMinor: 0n,
        platformFeeAmountMinor: data.platformFeeAmountMinor ?? 0n,
        totalAmountMinor: 1000n,
        pricingPolicyVersion: data.pricingPolicyVersion ?? 1,
        feePolicyVersionId: data.feePolicyVersionId,
        platformCommissionRuleId: data.platformCommissionRuleId,
        expiresAt: new Date(Date.now() + 900_000),
      },
    });
  }

  it('makes checkout pricing snapshots immutable while preserving normal lifecycle updates', async () => {
    const f = await ready({ percentBps: 1250 });
    const result = await checkout.create(f.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (result as { orderCode: string }).orderCode },
    });
    const other = await publishPlatformCommissionPolicy(prisma, f.sellerUser.id, {
      publicVersion: 2,
      status: 'DRAFT',
      percentBps: 0,
    });

    await expectImmutable(
      prisma.order.update({ where: { id: order.id }, data: { platformFeeAmountMinor: 126n } }),
    );
    await expectImmutable(
      prisma.order.update({ where: { id: order.id }, data: { feePolicyVersionId: other.id } }),
    );
    await expectImmutable(
      prisma.order.update({
        where: { id: order.id },
        data: { platformCommissionRuleId: other.rules[0].id },
      }),
    );
    await expectImmutable(
      prisma.order.update({ where: { id: order.id }, data: { pricingPolicyVersion: 999 } }),
    );
    await expectImmutable(
      prisma.order.update({
        where: { id: order.id },
        data: { feePolicyVersionId: null, platformCommissionRuleId: null },
      }),
    );
    await expectImmutable(
      prisma.order.update({ where: { id: order.id }, data: { feeSnapshotVersion: null } }),
    );
    const component = await prisma.orderFeeComponentSnapshot.findFirstOrThrow({
      where: { orderId: order.id },
    });
    await expect(
      prisma.orderFeeComponentSnapshot.update({
        where: { id: component.id },
        data: { percentBps: 1 },
      }),
    ).rejects.toThrow(/ORDER_FEE_COMPONENT_SNAPSHOT_IMMUTABLE/);
    await expect(
      prisma.orderFeeComponentSnapshot.delete({ where: { id: component.id } }),
    ).rejects.toThrow(/ORDER_FEE_COMPONENT_SNAPSHOT_IMMUTABLE/);

    await expect(
      prisma.order.update({
        where: { id: order.id },
        data: {
          status: 'CANCELLED',
          paymentStatus: 'EXPIRED',
          fulfillmentStatus: 'NOT_AVAILABLE',
          disputeStatus: 'NONE',
          version: { increment: 1 },
          cancelledAt: new Date(),
        },
      }),
    ).resolves.toMatchObject({
      id: order.id,
      feePolicyVersionId: f.policy.id,
      platformCommissionRuleId: f.policy.rules[0].id,
      pricingPolicyVersion: f.policy.publicVersion,
      platformFeeAmountMinor: 125n,
      status: 'CANCELLED',
    });
  });

  it('rejects an H2 component when its historical rule is not canonical for H1', async () => {
    const f = await ready({ percentBps: 1250 });
    const result = await checkout.create(f.buyer.id, key(), f.dto);
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: (result as { orderCode: string }).orderCode },
      include: { feeComponentSnapshots: true },
    });
    const component = order.feeComponentSnapshots[0];

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'replica'");
        await tx.orderFeeComponentSnapshot.delete({ where: { id: component.id } });
        await tx.feeRule.update({
          where: { id: component.feeRuleId },
          data: { sellerPlan: 'NON_CANONICAL_TEST' },
        });
        await tx.$executeRawUnsafe("SET LOCAL session_replication_role = 'origin'");
        await tx.orderFeeComponentSnapshot.create({
          data: {
            orderId: component.orderId,
            componentKind: component.componentKind,
            feePolicyVersionId: component.feePolicyVersionId,
            feeRuleId: component.feeRuleId,
            pricingPolicyVersion: component.pricingPolicyVersion,
            listingTier: component.listingTier,
            category: component.category,
            partyCharged: component.partyCharged,
            formula: component.formula,
            percentBps: component.percentBps,
            baseAmountMinor: component.baseAmountMinor,
            feeAmountMinor: component.feeAmountMinor,
            currency: component.currency,
          },
        });
      }),
    ).rejects.toThrow(/ORDER_FEE_COMPONENT_SNAPSHOT_INCONSISTENT/);
  });

  it('rejects an H2 Order without a LISTING_TIER component at deferred commit', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      percentBps: 1250,
    });
    const cart = await createCartShell(fixture);

    await expect(
      prisma.$transaction((tx) =>
        tx.order.create({
          data: {
            publicCode: `incomplete-h2-${crypto.randomUUID()}`,
            sourceCartId: cart.id,
            sourceCartVersion: cart.version,
            buyerUserId: fixture.buyer.id,
            sellerProfileId: fixture.seller.id,
            subtotalAmountMinor: 1000n,
            platformFeeAmountMinor: 125n,
            totalAmountMinor: 1000n,
            pricingPolicyVersion: policy.publicVersion,
            feePolicyVersionId: policy.id,
            platformCommissionRuleId: policy.rules[0].id,
            feeSnapshotVersion: 1,
            expiresAt: new Date(Date.now() + 900_000),
          },
        }),
      ),
    ).rejects.toThrow(/H2_LISTING_TIER_COMPONENT_REQUIRED/);
    expect(await prisma.order.count({ where: { sourceCartId: cart.id } })).toBe(0);
  });

  it('enforces policy/rule snapshot coherence while preserving true legacy null snapshots', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const policyA = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      percentBps: 1250,
    });
    const policyB = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      publicVersion: 2,
      status: 'DRAFT',
      percentBps: 0,
    });

    const legacyPreview = await createCartShell(fixture);
    const legacy = await createOrderShell(fixture, legacyPreview.id, legacyPreview.version, {
      feePolicyVersionId: null,
      platformCommissionRuleId: null,
    });
    await expect(
      prisma.order.update({
        where: { id: legacy.id },
        data: { status: 'CANCELLED', version: { increment: 1 }, cancelledAt: new Date() },
      }),
    ).resolves.toMatchObject({
      id: legacy.id,
      feePolicyVersionId: null,
      platformCommissionRuleId: null,
      feeSnapshotVersion: null,
    });
    expect(await prisma.orderFeeComponentSnapshot.count({ where: { orderId: legacy.id } })).toBe(0);
    await expectImmutable(
      prisma.order.update({ where: { id: legacy.id }, data: { feeSnapshotVersion: 1 } }),
    );

    const partialPolicyPreview = await createCartShell(fixture);
    await expect(
      createOrderShell(fixture, partialPolicyPreview.id, partialPolicyPreview.version, {
        feePolicyVersionId: policyA.id,
        platformCommissionRuleId: null,
      }),
    ).rejects.toBeDefined();

    const partialRulePreview = await createCartShell(fixture);
    await expect(
      createOrderShell(fixture, partialRulePreview.id, partialRulePreview.version, {
        feePolicyVersionId: null,
        platformCommissionRuleId: policyA.rules[0].id,
      }),
    ).rejects.toBeDefined();

    const mismatchPreview = await createCartShell(fixture);
    await expect(
      createOrderShell(fixture, mismatchPreview.id, mismatchPreview.version, {
        feePolicyVersionId: policyA.id,
        platformCommissionRuleId: policyB.rules[0].id,
        pricingPolicyVersion: policyA.publicVersion,
        platformFeeAmountMinor: 125n,
      }),
    ).rejects.toBeDefined();

    const coherentPreview = await createCartShell(fixture);
    await expect(
      createOrderShell(fixture, coherentPreview.id, coherentPreview.version, {
        feePolicyVersionId: policyA.id,
        platformCommissionRuleId: policyA.rules[0].id,
        pricingPolicyVersion: policyA.publicVersion,
        platformFeeAmountMinor: 125n,
      }),
    ).resolves.toMatchObject({
      feePolicyVersionId: policyA.id,
      platformCommissionRuleId: policyA.rules[0].id,
    });
  });

  it('runs concurrent checkouts with one coherent active policy snapshot', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 10, false);
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id, {
      formula: 'PERCENT_BPS',
      percentBps: 1250,
    });
    const firstPreview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const otherBuyer = await prisma.user.create({
      data: {
        email: `buyer-${crypto.randomUUID()}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
        roleAssignments: { create: { role: 'BUYER' } },
      },
    });
    const secondPreview = await carts.add(otherBuyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 2,
      expectedVersion: 0,
    });

    const [first, second] = await Promise.all([
      checkout.create(fixture.buyer.id, key(), {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: firstPreview.version,
        expectedPreviewFingerprint: firstPreview.previewFingerprint,
      }),
      checkout.create(otherBuyer.id, key(), {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: secondPreview.version,
        expectedPreviewFingerprint: secondPreview.previewFingerprint,
      }),
    ]);

    const orders = await prisma.order.findMany({
      where: {
        publicCode: {
          in: [
            (first as { orderCode: string }).orderCode,
            (second as { orderCode: string }).orderCode,
          ],
        },
      },
      orderBy: { subtotalAmountMinor: 'asc' },
    });
    expect(orders).toHaveLength(2);
    expect(
      orders.map((order) => ({
        policy: order.feePolicyVersionId,
        rule: order.platformCommissionRuleId,
        publicVersion: order.pricingPolicyVersion,
        subtotal: order.subtotalAmountMinor,
        fee: order.platformFeeAmountMinor,
        total: order.totalAmountMinor,
      })),
    ).toEqual([
      {
        policy: policy.id,
        rule: policy.rules[0].id,
        publicVersion: policy.publicVersion,
        subtotal: 1000n,
        fee: 125n,
        total: 1000n,
      },
      {
        policy: policy.id,
        rule: policy.rules[0].id,
        publicVersion: policy.publicVersion,
        subtotal: 2000n,
        fee: 250n,
        total: 2000n,
      },
    ]);
  });

  it('holds a shared policy lock until the checkout transaction commits', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL', undefined, 5, false);
    const policy = await publishPlatformCommissionPolicy(prisma, fixture.sellerUser.id);
    let signalLocked!: () => void;
    let release!: () => void;
    const locked = new Promise<void>((resolve) => (signalLocked = resolve));
    const barrier = new Promise<void>((resolve) => (release = resolve));
    const transactionA = prisma.$transaction(async (tx) => {
      await listingTierPolicy.resolve(tx, 'SILVER', 1000n);
      signalLocked();
      await barrier;
    });
    await locked;
    try {
      await expect(
        prisma.$transaction(async (tx) => {
          await tx.$executeRawUnsafe(`SET LOCAL lock_timeout = '100ms'`);
          await tx.$executeRaw`UPDATE "FeePolicyVersion" SET "status" = 'RETIRED' WHERE "id" = ${policy.id}::uuid`;
        }),
      ).rejects.toBeDefined();
    } finally {
      release();
      await transactionA;
    }
    await expect(
      prisma.feePolicyVersion.update({ where: { id: policy.id }, data: { status: 'RETIRED' } }),
    ).resolves.toMatchObject({ status: 'RETIRED' });
  });

  it('does not depend on PSP or ledger posting from CheckoutService', () => {
    const source = readFileSync(join(__dirname, '../src/checkout/checkout.service.ts'), 'utf8');
    expect(source).not.toContain('PaymentProviderPort');
    expect(source).not.toContain('EfiPaymentProvider');
    expect(source).not.toContain('createPayment');
    expect(source).not.toContain('getPayment');
    expect(source).not.toContain('cancelPayment');
    expect(source).not.toContain('refundPayment');
    expect(source).not.toContain('httpService');
    expect(source).not.toContain('HttpService');
    expect(source).not.toContain('FinancialLedgerService');
    expect(source).not.toContain('.post(');
  });
});
