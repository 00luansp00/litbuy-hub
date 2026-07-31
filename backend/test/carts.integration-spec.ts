import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { CartsService } from '../src/carts/carts.service';
import type { SecurityEventType } from '@prisma/client';

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
  async function rejectAudit(eventType: SecurityEventType) {
    const suffix = eventType.toLowerCase();
    const functionName = `reject_cart_audit_${suffix}`;
    const triggerName = `reject_cart_audit_trigger_${suffix}`;
    await prisma.$executeRawUnsafe(`
      CREATE OR REPLACE FUNCTION "${functionName}"() RETURNS trigger AS $$
      BEGIN
        IF NEW."eventType" = '${eventType}' THEN RAISE EXCEPTION 'audit rejected'; END IF;
        RETURN NEW;
      END; $$ LANGUAGE plpgsql
    `);
    await prisma.$executeRawUnsafe(`
      CREATE TRIGGER "${triggerName}" BEFORE INSERT ON "SecurityEvent"
      FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
    `);
    return async () => {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${triggerName}" ON "SecurityEvent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${functionName}"()`);
    };
  }
  async function createNormalProduct(sellerProfileId: string, categoryId: string, label: string) {
    const suffix = crypto.randomUUID();
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId,
        categoryId,
        productType: 'GAME',
        model: 'NORMAL',
        status: 'APPROVED',
      },
    });
    return prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId,
        categoryId,
        productType: 'GAME',
        model: 'NORMAL',
        status: 'ACTIVE',
        slug: `normal-${label}-${suffix}`,
        title: `Normal ${label}`,
        description: 'Description',
        price: 10,
        stock: 10,
        variants: { create: { title: 'Canonical', price: 10, stock: 10 } },
        images: {
          create: {
            objectKey: `cart-integration/${label}/${suffix}`,
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
    });
  }
  async function createCommercialProduct(
    sellerProfileId: string,
    categoryId: string,
    model: 'DYNAMIC' | 'SERVICE',
    pricingType?: 'FIXED' | 'QUOTE',
  ) {
    const suffix = crypto.randomUUID();
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId,
        categoryId,
        productType: model === 'SERVICE' ? 'SERVICE' : 'GAME',
        model,
        status: 'APPROVED',
      },
    });
    const fixed = model === 'SERVICE' && pricingType === 'FIXED';
    return prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId,
        categoryId,
        productType: model === 'SERVICE' ? 'SERVICE' : 'GAME',
        model,
        status: 'ACTIVE',
        slug: `commercial-${model.toLowerCase()}-${suffix}`,
        title: `Commercial ${model}`,
        description: 'Description',
        variants: {
          create:
            model === 'DYNAMIC'
              ? [
                  { title: 'First', price: 15, stock: 8 },
                  { title: 'Second', price: 20, stock: 6 },
                ]
              : fixed
                ? [{ title: 'Canonical', price: 25, stock: 0 }]
                : [],
        },
        serviceDetails:
          model === 'SERVICE'
            ? {
                create: {
                  pricingType: pricingType ?? 'QUOTE',
                  basePrice: fixed ? 25 : null,
                },
              }
            : undefined,
        images: {
          create: {
            objectKey: `cart-integration/commercial/${suffix}`,
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
  it.each(['UNPUBLISHED', 'PAUSED', 'REMOVED'] as const)(
    'rejects a %s NORMAL product with one generic public error and no mutation',
    async (status) => {
      const f = await fixture();
      await prisma.product.update({ where: { id: f.product.id }, data: { status } });
      await expect(
        service.add(f.buyer.id, f.seller.slug, {
          productId: f.product.id,
          quantity: 1,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({
        code: 'PRODUCT_NOT_PURCHASABLE',
        message: 'PRODUCT_NOT_PURCHASABLE',
      });
      expect(await prisma.cartItem.count({ where: { cartId: f.cart.id } })).toBe(0);
      expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
        version: 1,
      });
      expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(0);
    },
  );
  it('rejects self-purchase without leaving a cart, item, version or event', async () => {
    const f = await fixture();
    await expect(
      service.add(f.seller.userId, f.seller.slug, {
        productId: f.product.id,
        quantity: 1,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'SELF_PURCHASE_NOT_ALLOWED' });
    expect(await prisma.cart.count({ where: { buyerUserId: f.seller.userId } })).toBe(0);
    expect(await prisma.cartItem.count({ where: { cart: { buyerUserId: f.seller.userId } } })).toBe(
      0,
    );
    expect(await prisma.securityEvent.count({ where: { userId: f.seller.userId } })).toBe(0);
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
  it('serializes concurrent additions of different lines at the same version', async () => {
    const f = await fixture();
    const [first, second] = await Promise.all([
      createNormalProduct(f.seller.id, f.product.categoryId, 'concurrent-a'),
      createNormalProduct(f.seller.id, f.product.categoryId, 'concurrent-b'),
    ]);
    const results = await Promise.allSettled([
      service.add(f.buyer.id, f.seller.slug, {
        productId: first.id,
        quantity: 1,
        expectedVersion: 1,
      }),
      service.add(f.buyer.id, f.seller.slug, {
        productId: second.id,
        quantity: 1,
        expectedVersion: 1,
      }),
    ]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(results.find(({ status }) => status === 'rejected')).toMatchObject({
      reason: { code: 'CART_VERSION_CONFLICT' },
    });
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
      version: 2,
    });
    expect(await prisma.cartItem.count({ where: { cartId: f.cart.id } })).toBe(1);
    expect(
      await prisma.securityEvent.count({
        where: { userId: f.buyer.id, eventType: 'CART_ITEM_ADDED' },
      }),
    ).toBe(1);
  });
  it('rejects the 51st line without changing version, items, events or stock', async () => {
    const f = await fixture();
    const products = await Promise.all(
      Array.from({ length: 51 }, (_, index) =>
        createNormalProduct(f.seller.id, f.product.categoryId, `limit-${index}`),
      ),
    );
    for (const [index, product] of products.slice(0, 50).entries())
      await service.add(f.buyer.id, f.seller.slug, {
        productId: product.id,
        quantity: 1,
        expectedVersion: index + 1,
      });
    const versionBefore = (await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } }))
      .version;
    const eventsBefore = await prisma.securityEvent.count({ where: { userId: f.buyer.id } });
    const stockBefore = await prisma.product.findUniqueOrThrow({ where: { id: products[50].id } });
    await expect(
      service.add(f.buyer.id, f.seller.slug, {
        productId: products[50].id,
        quantity: 1,
        expectedVersion: versionBefore,
      }),
    ).rejects.toMatchObject({ code: 'CART_ITEM_LIMIT_REACHED' });
    expect(await prisma.cartItem.count({ where: { cartId: f.cart.id } })).toBe(50);
    expect(await prisma.cart.findUniqueOrThrow({ where: { id: f.cart.id } })).toMatchObject({
      version: versionBefore,
    });
    expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(eventsBefore);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: products[50].id } })).stock).toBe(
      stockBefore.stock,
    );
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
  it('validates DYNAMIC selections and never changes product or variant stock', async () => {
    const f = await fixture();
    const dynamic = await createCommercialProduct(f.seller.id, f.product.categoryId, 'DYNAMIC');
    const selected = dynamic.variants[0];
    const stocksBefore = dynamic.variants.map(({ id, stock }) => ({ id, stock }));
    await expect(
      service.add(f.buyer.id, f.seller.slug, {
        productId: dynamic.id,
        quantity: 1,
        expectedVersion: 1,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_VARIANT_REQUIRED' });
    const added = await service.add(f.buyer.id, f.seller.slug, {
      productId: dynamic.id,
      productVariantId: selected.id,
      quantity: 2,
      expectedVersion: 1,
    });
    const itemId = added.items[0].id;
    await service.update(f.buyer.id, f.seller.slug, itemId, {
      quantity: 3,
      expectedVersion: 2,
    });
    await expect(
      service.update(f.buyer.id, f.seller.slug, itemId, {
        quantity: 9,
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: 'INSUFFICIENT_STOCK' });
    await service.remove(f.buyer.id, f.seller.slug, itemId, { expectedVersion: 3 });
    const after = await prisma.product.findUniqueOrThrow({
      where: { id: dynamic.id },
      include: { variants: { orderBy: { id: 'asc' } } },
    });
    expect(after.stock).toBe(dynamic.stock);
    expect(
      after.variants
        .map(({ id, stock }) => ({ id, stock }))
        .sort((a, b) => a.id.localeCompare(b.id)),
    ).toEqual(stocksBefore.sort((a, b) => a.id.localeCompare(b.id)));
  });
  it('supports FIXED quantity one and rejects quantity two without stock effects', async () => {
    const f = await fixture();
    const fixed = await createCommercialProduct(
      f.seller.id,
      f.product.categoryId,
      'SERVICE',
      'FIXED',
    );
    const added = await service.add(f.buyer.id, f.seller.slug, {
      productId: fixed.id,
      quantity: 1,
      expectedVersion: 1,
    });
    expect(added.items[0]).toMatchObject({ currentUnitAmountMinor: '2500' });
    const itemId = added.items[0].id;
    await service.update(f.buyer.id, f.seller.slug, itemId, {
      quantity: 1,
      expectedVersion: 2,
    });
    await expect(
      service.update(f.buyer.id, f.seller.slug, itemId, {
        quantity: 2,
        expectedVersion: 3,
      }),
    ).rejects.toMatchObject({ code: 'QUANTITY_UNAVAILABLE' });
    await service.remove(f.buyer.id, f.seller.slug, itemId, { expectedVersion: 3 });
    expect(await prisma.product.findUniqueOrThrow({ where: { id: fixed.id } })).toMatchObject({
      stock: fixed.stock,
    });
  });
  it('rejects QUOTE and self-purchase without creating commercial state', async () => {
    const f = await fixture();
    await prisma.cart.delete({ where: { id: f.cart.id } });
    const quote = await createCommercialProduct(
      f.seller.id,
      f.product.categoryId,
      'SERVICE',
      'QUOTE',
    );
    await expect(
      service.add(f.buyer.id, f.seller.slug, {
        productId: quote.id,
        quantity: 1,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'PRODUCT_REQUIRES_QUOTE' });
    await expect(
      service.add(f.seller.userId, f.seller.slug, {
        productId: f.product.id,
        quantity: 1,
        expectedVersion: 0,
      }),
    ).rejects.toMatchObject({ code: 'SELF_PURCHASE_NOT_ALLOWED' });
    expect(await prisma.cart.count()).toBe(0);
    expect(await prisma.cartItem.count()).toBe(0);
    expect(await prisma.securityEvent.count()).toBe(0);
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
      const cleanup = await rejectAudit(eventType);
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
        await cleanup();
      }
    },
  );
  it('rolls back CART_ITEM_ADDED for an existing cart without disturbing prior state', async () => {
    const f = await fixture();
    const existing = await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    const other = await createNormalProduct(f.seller.id, f.product.categoryId, 'audit-add');
    await prisma.securityEvent.create({
      data: {
        userId: f.buyer.id,
        eventType: 'CART_ITEM_ADDED',
        outcome: 'SUCCESS',
        metadata: { cartId: f.cart.id, cartItemId: existing.id, action: 'BASELINE' },
      },
    });
    const before = await prisma.cart.findUniqueOrThrow({
      where: { id: f.cart.id },
      include: { items: true },
    });
    const eventsBefore = await prisma.securityEvent.count({ where: { userId: f.buyer.id } });
    const cleanup = await rejectAudit('CART_ITEM_ADDED');
    try {
      await expect(
        service.add(f.buyer.id, f.seller.slug, {
          productId: other.id,
          quantity: 1,
          expectedVersion: before.version,
        }),
      ).rejects.toBeDefined();
      const after = await prisma.cart.findUniqueOrThrow({
        where: { id: f.cart.id },
        include: { items: true },
      });
      expect(after.version).toBe(before.version);
      expect(after.items).toEqual(before.items);
      expect(await prisma.securityEvent.count({ where: { userId: f.buyer.id } })).toBe(
        eventsBefore,
      );
    } finally {
      await cleanup();
    }
  });
  it.each([
    ['CART_ITEM_UPDATED', 'update'],
    ['CART_ITEM_REMOVED', 'remove'],
  ] as const)('rolls back %s together with its version bump', async (eventType, action) => {
    const f = await fixture();
    const item = await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    const cleanup = await rejectAudit(eventType);
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
      await cleanup();
    }
  });
});
