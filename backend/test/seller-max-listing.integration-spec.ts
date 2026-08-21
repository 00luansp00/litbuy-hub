import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';
import { PrismaService } from '../src/database/prisma.service';
import { ProductMaterializationService } from '../src/products/product-materialization.service';
import { commerceFixture } from './order-checkout-test.helpers';

describe('I1 Seller MAX listing authority with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let carts: CartsService;
  let checkout: CheckoutService;
  let materialization: ProductMaterializationService;

  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    carts = app.get(CartsService);
    checkout = app.get(CheckoutService);
    materialization = app.get(ProductMaterializationService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());

  it('defaults products without pre-I1 MAX evidence to STANDARD and rejects arbitrary plan values', async () => {
    const fixture = await commerceFixture(prisma, 'NORMAL');
    expect(fixture.product.sellerPlan).toBe('STANDARD');
    await expect(
      prisma.$executeRawUnsafe(
        `UPDATE "ListingDraft" SET "requestedSellerPlan" = 'ARBITRARY' WHERE "id" = '${fixture.draft.id}'`,
      ),
    ).rejects.toThrow(/invalid input value for enum/);
  });

  it.each(['STANDARD', 'LIT_MAX'] as const)(
    'persists %s in the Draft and materializes the same authoritative Product plan',
    async (sellerPlan) => {
      const fixture = await commerceFixture(prisma, 'NORMAL');
      await prisma.productImage.deleteMany({ where: { productId: fixture.product.id } });
      await prisma.productVariant.deleteMany({ where: { productId: fixture.product.id } });
      await prisma.product.delete({ where: { id: fixture.product.id } });
      const draft = await prisma.listingDraft.update({
        where: { id: fixture.draft.id },
        data: {
          requestedSellerPlan: sellerPlan,
          title: `${sellerPlan} listing`,
          description: 'Authoritative plan source',
          price: 10,
          stock: 5,
        },
      });

      const product = await prisma.$transaction((tx) =>
        materialization.materializeFromApprovedDraft(
          tx,
          draft.id,
          fixture.sellerUser.id,
          'approval',
        ),
      );

      expect(draft.requestedSellerPlan).toBe(sellerPlan);
      expect(product.sellerPlan).toBe(sellerPlan);
      expect(materialization.productReference(product)).toMatchObject({ sellerPlan });
    },
  );

  async function ready(sellerPlan: 'STANDARD' | 'LIT_MAX') {
    const fixture = await commerceFixture(prisma, 'NORMAL');
    await prisma.listingDraft.update({
      where: { id: fixture.draft.id },
      data: { requestedSellerPlan: sellerPlan },
    });
    await prisma.product.update({
      where: { id: fixture.product.id },
      data: { sellerPlan },
    });
    const preview = await carts.add(fixture.buyer.id, fixture.seller.slug, {
      productId: fixture.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    return {
      ...fixture,
      cartId: preview.id,
      dto: {
        sellerSlug: fixture.seller.slug,
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    };
  }

  it.each([
    ['STANDARD', 99n, []],
    [
      'LIT_MAX',
      128n,
      [expect.objectContaining({ componentKind: 'SELLER_MAX', feeAmountMinor: 29n })],
    ],
  ] as const)(
    'freezes Product %s and applies the CURRENT fee components without changing Buyer total or release policy',
    async (sellerPlan, aggregateFee, maxComponents) => {
      const f = await ready(sellerPlan);
      const response = await checkout.create(
        f.buyer.id,
        parseIdempotencyKey(`seller-plan:${crypto.randomUUID()}`),
        f.dto,
      );
      const order = await prisma.order.findUniqueOrThrow({
        where: { publicCode: (response as { orderCode: string }).orderCode },
        include: { feeComponentSnapshots: true },
      });

      expect(order).toMatchObject({
        commercialSnapshotVersion: 1,
        sellerPlanSnapshot: sellerPlan,
        subtotalAmountMinor: 1_000n,
        totalAmountMinor: 1_000n,
        platformFeeAmountMinor: aggregateFee,
        frozenBaseReleaseDelayHours: 168,
      });
      expect(order.feeComponentSnapshots).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ componentKind: 'LISTING_TIER', feeAmountMinor: 99n }),
          ...maxComponents,
        ]),
      );
      expect(order.feeComponentSnapshots).toHaveLength(sellerPlan === 'LIT_MAX' ? 2 : 1);
    },
  );

  it('keeps the first snapshot on idempotent replay after Product plan changes', async () => {
    const f = await ready('LIT_MAX');
    const key = parseIdempotencyKey(`seller-plan:${crypto.randomUUID()}`);
    const first = await checkout.create(f.buyer.id, key, f.dto);
    await prisma.product.update({ where: { id: f.product.id }, data: { sellerPlan: 'STANDARD' } });
    const replay = await checkout.create(f.buyer.id, key, f.dto);
    const orders = await prisma.order.findMany();

    expect(replay).toEqual(first);
    expect(orders).toHaveLength(1);
    expect(orders[0]).toMatchObject({
      commercialSnapshotVersion: 1,
      sellerPlanSnapshot: 'LIT_MAX',
    });
  });

  it('reads legacy NULL snapshots and rejects mutation of a historical v1 snapshot', async () => {
    const f = await ready('STANDARD');
    const legacyCart = await prisma.cart.create({
      data: {
        buyerUserId: f.buyer.id,
        sellerProfileId: f.seller.id,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    const legacy = await prisma.order.create({
      data: {
        publicCode: `LEGACY-${crypto.randomUUID()}`,
        sourceCartId: legacyCart.id,
        sourceCartVersion: 1,
        buyerUserId: f.buyer.id,
        sellerProfileId: f.seller.id,
        subtotalAmountMinor: 1_000n,
        totalAmountMinor: 1_000n,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    expect(legacy).toMatchObject({
      commercialSnapshotVersion: null,
      sellerPlanSnapshot: null,
    });

    const checkedOut = await checkout.create(
      f.buyer.id,
      parseIdempotencyKey(`seller-plan:${crypto.randomUUID()}`),
      f.dto,
    );
    await expect(
      prisma.order.update({
        where: { publicCode: (checkedOut as { orderCode: string }).orderCode },
        data: { sellerPlanSnapshot: 'LIT_MAX' },
      }),
    ).rejects.toThrow(/ORDER_COMMERCIAL_SNAPSHOT_IMMUTABLE/);
  });
});
