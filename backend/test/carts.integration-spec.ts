import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';

describe('Cart database constraints with real PostgreSQL', () => {
  let prisma: PrismaService;
  let service: CartsService;
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    service = app.get(CartsService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());
  async function fixture() {
    const suffix = crypto.randomUUID();
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${suffix}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-${suffix}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId: sellerUser.id, storeName: 'Store', slug: `store-${suffix}` },
    });
    const category = await prisma.catalogCategory.create({
      data: { name: 'Cat', slug: `cat-${suffix}` },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'GAME',
        model: 'NORMAL',
        status: 'APPROVED',
      },
    });
    const product = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'GAME',
        model: 'NORMAL',
        status: 'ACTIVE',
        slug: `product-${suffix}`,
        title: 'Product',
        description: 'Description',
        price: 10,
        stock: 10,
        variants: { create: { title: 'One', price: 10, stock: 10 } },
        images: {
          create: {
            objectKey: `cart-integration/${suffix}`,
            status: 'READY',
            contentType: 'image/png',
            sizeBytes: 1,
            sortOrder: 0,
            isCover: true,
            uploadedAt: new Date(),
            uploadExpiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
      include: { variants: true },
    });
    const cart = await prisma.cart.create({
      data: { buyerUserId: buyer.id, sellerProfileId: seller.id },
    });
    return { buyer, seller, product, variant: product.variants[0], cart };
  }
  it('rejects a second ACTIVE cart for one buyer and seller', async () => {
    const f = await fixture();
    await expect(
      prisma.cart.create({ data: { buyerUserId: f.buyer.id, sellerProfileId: f.seller.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects duplicate lines without a variant', async () => {
    const f = await fixture();
    await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    await expect(
      prisma.cartItem.create({ data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects duplicate lines with the same variant', async () => {
    const f = await fixture();
    await prisma.cartItem.create({
      data: {
        cartId: f.cart.id,
        productId: f.product.id,
        productVariantId: f.variant.id,
        quantity: 1,
      },
    });
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: f.cart.id,
          productId: f.product.id,
          productVariantId: f.variant.id,
          quantity: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it.each([0, 1000])('rejects quantity %s', async (quantity) => {
    const f = await fixture();
    await expect(
      prisma.cartItem.create({ data: { cartId: f.cart.id, productId: f.product.id, quantity } }),
    ).rejects.toBeDefined();
  });
  it('rejects version zero', async () => {
    const f = await fixture();
    await expect(
      prisma.cart.update({ where: { id: f.cart.id }, data: { version: 0 } }),
    ).rejects.toBeDefined();
  });
  it('rejects a variant belonging to another product', async () => {
    const f = await fixture();
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: f.seller.id,
        categoryId: f.product.categoryId,
        productType: 'GAME',
        model: 'DYNAMIC',
        status: 'APPROVED',
      },
    });
    const other = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: f.seller.id,
        categoryId: f.product.categoryId,
        productType: 'GAME',
        model: 'DYNAMIC',
        slug: `other-${crypto.randomUUID()}`,
        title: 'Other',
        description: 'Other',
        variants: { create: { title: 'Other', price: 10, stock: 10 } },
      },
      include: { variants: true },
    });
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: f.cart.id,
          productId: f.product.id,
          productVariantId: other.variants[0].id,
          quantity: 1,
        },
      }),
    ).rejects.toBeDefined();
  });
  it('serializes concurrent cart creation into one success and one safe version conflict', async () => {
    const f = await fixture();
    await prisma.cart.delete({ where: { id: f.cart.id } });
    const results = await Promise.allSettled([
      service.add(f.buyer.id, f.seller.slug, {
        productId: f.product.id,
        quantity: 1,
        expectedVersion: 0,
      }),
      service.add(f.buyer.id, f.seller.slug, {
        productId: f.product.id,
        quantity: 1,
        expectedVersion: 0,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    const rejected = results.find(({ status }) => status === 'rejected');
    expect(rejected).toMatchObject({ reason: { code: 'CART_VERSION_CONFLICT' } });
    const cart = await prisma.cart.findFirstOrThrow({
      where: { buyerUserId: f.buyer.id, sellerProfileId: f.seller.id, status: 'ACTIVE' },
      include: { items: true },
    });
    expect(cart).toMatchObject({ version: 1 });
    expect(cart.items).toHaveLength(1);
    expect(
      await prisma.securityEvent.count({
        where: {
          userId: f.buyer.id,
          eventType: { in: ['CART_CREATED', 'CART_ITEM_ADDED'] },
        },
      }),
    ).toBe(2);
  });
  it('does not bump version or audit a duplicate selection', async () => {
    const f = await fixture();
    await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    await expect(
      service.add(f.buyer.id, f.seller.slug, {
        productId: f.product.id,
        quantity: 1,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'CART_ITEM_ALREADY_EXISTS' });
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
      version: 1,
    });
    expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(0);
  });
  it('allows exactly one concurrent PATCH and writes one winning event', async () => {
    const f = await fixture();
    const item = await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    const results = await Promise.allSettled([
      service.update(f.buyer.id, f.seller.slug, item.id, { quantity: 2, expectedVersion: 1 }),
      service.update(f.buyer.id, f.seller.slug, item.id, { quantity: 3, expectedVersion: 1 }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: { code: 'CART_VERSION_CONFLICT' },
    });
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
      version: 2,
    });
    expect([2, 3]).toContain(
      (await prisma.cartItem.findUniqueOrThrow({ where: { id: item.id } })).quantity,
    );
    expect(
      await prisma.securityEvent.count({
        where: { userId: f.buyer.id, eventType: 'CART_ITEM_UPDATED' },
      }),
    ).toBe(1);
  });
  it('never changes NORMAL product or canonical variant stock across add, patch and delete', async () => {
    const f = await fixture();
    await prisma.cart.delete({ where: { id: f.cart.id } });
    const before = await prisma.product.findUniqueOrThrow({
      where: { id: f.product.id },
      include: { variants: true },
    });
    const added = await service.add(f.buyer.id, f.seller.slug, {
      productId: f.product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const itemId = added.items[0].id;
    await service.update(f.buyer.id, f.seller.slug, itemId, {
      quantity: 2,
      expectedVersion: 1,
    });
    await service.remove(f.buyer.id, f.seller.slug, itemId, { expectedVersion: 2 });
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: f.product.id },
      include: { variants: true },
    });
    expect(after.stock).toBe(before.stock);
    expect(after.variants[0].stock).toBe(before.variants[0].stock);
    expect(
      await prisma.cart.findFirstOrThrow({ where: { buyerUserId: f.buyer.id } }),
    ).toMatchObject({ status: 'ACTIVE', version: 3 });
    expect(await prisma.cartItem.count({ where: { cart: { buyerUserId: f.buyer.id } } })).toBe(0);
  });
  it('reconciles catalog drift without mutating the cart, item, stock or audit log', async () => {
    const f = await fixture();
    await prisma.cart.delete({ where: { id: f.cart.id } });
    await service.add(f.buyer.id, f.seller.slug, {
      productId: f.product.id,
      quantity: 2,
      expectedVersion: 0,
    });
    const before = await prisma.cart.findFirstOrThrow({
      where: { buyerUserId: f.buyer.id },
      include: { items: true },
    });
    const eventsBefore = await prisma.securityEvent.count({ where: { userId: f.buyer.id } });
    await prisma.product.update({ where: { id: f.product.id }, data: { status: 'PAUSED' } });
    const response = await service.get(f.buyer.id, f.seller.slug);
    const after = await prisma.cart.findUniqueOrThrow({
      where: { id: before.id },
      include: { items: true },
    });
    expect(response).toMatchObject({
      version: before.version,
      checkoutReady: false,
      previewSubtotalMinor: null,
      items: [{ quantity: 2, purchasable: false, issues: ['PRODUCT_UNAVAILABLE'] }],
    });
    expect(after).toMatchObject({ version: before.version, updatedAt: before.updatedAt });
    expect(after.items).toEqual(before.items);
    expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(eventsBefore);
  });
  it.each(['CART_CREATED', 'CART_ITEM_ADDED'] as const)(
    'rolls back initial cart mutation when %s audit insertion fails',
    async (eventType) => {
      const f = await fixture();
      await prisma.cart.delete({ where: { id: f.cart.id } });
      await prisma.$executeRawUnsafe(`
        CREATE OR REPLACE FUNCTION reject_cart_audit() RETURNS trigger AS $$
        BEGIN
          IF NEW."eventType" = '${eventType}' THEN RAISE EXCEPTION 'audit rejected'; END IF;
          RETURN NEW;
        END; $$ LANGUAGE plpgsql;
        CREATE TRIGGER reject_cart_audit_trigger BEFORE INSERT ON "SecurityEvent"
        FOR EACH ROW EXECUTE FUNCTION reject_cart_audit();
      `);
      try {
        await expect(
          service.add(f.buyer.id, f.seller.slug, {
            productId: f.product.id,
            quantity: 1,
            expectedVersion: 0,
          }),
        ).rejects.toBeDefined();
        expect(await prisma.cart.count({ where: { buyerUserId: f.buyer.id } })).toBe(0);
        expect(await prisma.cartItem.count()).toBe(0);
        expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(0);
      } finally {
        await prisma.$executeRawUnsafe(
          'DROP TRIGGER IF EXISTS reject_cart_audit_trigger ON "SecurityEvent"; DROP FUNCTION IF EXISTS reject_cart_audit();',
        );
      }
    },
  );
  it.each([
    ['CART_ITEM_UPDATED', 'update'],
    ['CART_ITEM_REMOVED', 'remove'],
  ] as const)('rolls back %s together with its version bump', async (eventType, action) => {
    const f = await fixture();
    const item = await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION reject_cart_audit() RETURNS trigger AS $$
      BEGIN
        IF NEW."eventType" = '${eventType}' THEN RAISE EXCEPTION 'audit rejected'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql;
      CREATE TRIGGER reject_cart_audit_trigger BEFORE INSERT ON "SecurityEvent"
      FOR EACH ROW EXECUTE FUNCTION reject_cart_audit();
    `);
    try {
      const operation =
        action === 'update'
          ? service.update(f.buyer.id, f.seller.slug, item.id, {
              quantity: 2,
              expectedVersion: 1,
            })
          : service.remove(f.buyer.id, f.seller.slug, item.id, { expectedVersion: 1 });
      await expect(operation).rejects.toBeDefined();
      expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
        version: 1,
      });
      expect(await prisma.cartItem.findUniqueOrThrow({ where: { id: item.id } })).toMatchObject({
        quantity: 1,
      });
    } finally {
      await prisma.$executeRawUnsafe(
        'DROP TRIGGER IF EXISTS reject_cart_audit_trigger ON "SecurityEvent"; DROP FUNCTION IF EXISTS reject_cart_audit();',
      );
    }
  });
});
