import { PrismaClient } from '@prisma/client';
import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import type { AppConfig } from '../src/config/app.config';
import { RedisService } from '../src/redis/redis.service';
import {
  DEMO_CATEGORIES,
  DEMO_FEE_POLICY,
  DEMO_IDS,
  DEMO_IMAGES,
  DEMO_PRODUCTS,
  DEMO_SELLER_RELEASE_POLICY,
  DEMO_SUMMARY,
  DEMO_USERS,
} from '../src/cli/demo-data.fixtures';
import { runDemoCommand } from '../src/cli/demo-data';
import { CartsService } from '../src/carts/carts.service';
import { CheckoutService } from '../src/checkout/checkout.service';
import { parseIdempotencyKey } from '../src/commerce/idempotency-key';

const prisma = new PrismaClient();
const env = process.env;
const s3 = new S3Client({
  endpoint: env.PRODUCT_IMAGE_S3_ENDPOINT,
  region: env.PRODUCT_IMAGE_S3_REGION ?? 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.PRODUCT_IMAGE_S3_ACCESS_KEY!,
    secretAccessKey: env.PRODUCT_IMAGE_S3_SECRET_KEY!,
  },
});
const bucket = env.PRODUCT_IMAGE_S3_BUCKET!;
const bytes = async (body: unknown) =>
  Buffer.from(
    await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray(),
  );
const externalUser = (id: string, email: string) => ({
  id,
  email,
  birthDate: new Date('1990-01-01'),
  status: 'ACTIVE' as const,
  emailVerifiedAt: new Date('2025-01-01'),
  termsVersion: 'external',
  termsAcceptedAt: new Date('2025-01-01'),
  privacyVersion: 'external',
  privacyAcceptedAt: new Date('2025-01-01'),
});

describe('local demo data with real PostgreSQL and MinIO', () => {
  jest.setTimeout(180_000);
  let app: INestApplication;
  const cleanupIntegrationDatabase = () =>
    prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    const appConfig = app.get(ConfigService).getOrThrow<AppConfig>('app');
    app.setGlobalPrefix(appConfig.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    // This suite shares an ephemeral PostgreSQL database with financial integration suites.
    // Test-only truncation prevents their immutable published policies from leaking in here.
    await cleanupIntegrationDatabase();
    await (await app.get(RedisService).getClient()).flushdb();
    await runDemoCommand(['reset', '--confirm'], env);
  });
  afterAll(async () => {
    await runDemoCommand(['reset', '--confirm'], env);
    // Do not leak this suite's intentionally persistent financial baseline to later suites.
    await cleanupIntegrationDatabase();
    await app.close();
    s3.destroy();
    await prisma.$disconnect();
  });

  it('seeds, verifies and remains deterministic on a second seed', async () => {
    expect(await runDemoCommand(['seed'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    const before = await prisma.product.findMany({
      where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, updatedAt: true },
    });
    expect(await runDemoCommand(['seed'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await prisma.user.count({ where: { id: { in: DEMO_USERS.map((x) => x.id) } } })).toBe(3);
    expect(
      await prisma.product.count({ where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } } }),
    ).toBe(8);
    expect(
      await prisma.productImage.count({
        where: { objectKey: { in: DEMO_IMAGES.map((x) => x.objectKey) } },
      }),
    ).toBe(8);
    expect(
      await prisma.product.findMany({
        where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, updatedAt: true },
      }),
    ).toEqual(before);
    expect(
      await prisma.feePolicyVersion.findUnique({
        where: { id: DEMO_FEE_POLICY.id },
        include: { rules: true },
      }),
    ).toMatchObject({
      publicVersion: DEMO_FEE_POLICY.publicVersion,
      status: 'ACTIVE',
      rules: [
        {
          category: 'PLATFORM_COMMISSION',
          partyCharged: 'SELLER',
          formula: 'FIXED',
          fixedAmountMinor: 0n,
          percentBps: null,
        },
      ],
    });
  });

  it('lets the real checkout resolver snapshot the explicit zero demo commission', async () => {
    await runDemoCommand(['seed'], env);
    const carts = app.get(CartsService);
    const checkout = app.get(CheckoutService);
    const product = DEMO_PRODUCTS[0];
    const preview = await carts.add(DEMO_IDS.users.buyer, 'demo-lit-store', {
      productId: product.id,
      quantity: 1,
      expectedVersion: 0,
    });
    const created = await checkout.create(
      DEMO_IDS.users.buyer,
      parseIdempotencyKey(crypto.randomUUID()),
      {
        sellerSlug: 'demo-lit-store',
        expectedCartVersion: preview.version,
        expectedPreviewFingerprint: preview.previewFingerprint,
      },
    );
    const orderCode = (created as { orderCode: string }).orderCode;
    const order = await prisma.order.findUniqueOrThrow({
      where: { publicCode: orderCode },
    });
    expect(order).toMatchObject({
      feePolicyVersionId: DEMO_FEE_POLICY.id,
      platformCommissionRuleId: DEMO_FEE_POLICY.rule.id,
      platformFeeAmountMinor: 0n,
      sellerReleasePolicyVersionId: DEMO_SELLER_RELEASE_POLICY.id,
      sellerReleasePolicyRuleId: DEMO_SELLER_RELEASE_POLICY.rule.id,
      sellerReleasePolicySource: 'DEFAULT',
      sellerReleasePolicyCategoryId: product.categoryId,
      sellerReleasePolicySubcategoryId: product.subcategoryId,
      frozenBaseReleaseDelayHours: 168,
    });
    expect(order.totalAmountMinor - order.platformFeeAmountMinor).toBe(order.subtotalAmountMinor);
  });

  it('fails closed for an effective external fee policy without modifying it', async () => {
    await cleanupIntegrationDatabase();
    const externalAuthor = await prisma.user.create({
      data: externalUser(
        crypto.randomUUID(),
        `external-policy-${crypto.randomUUID()}@example.test`,
      ),
    });
    const externalPolicy = await prisma.feePolicyVersion.create({
      data: {
        publicVersion: 1,
        status: 'DRAFT',
        effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
        createdByUserId: externalAuthor.id,
        rules: {
          create: {
            category: 'PLATFORM_COMMISSION',
            code: 'external-zero-commission',
            formula: 'FIXED',
            partyCharged: 'SELLER',
            fixedAmountMinor: 0n,
          },
        },
      },
    });
    await prisma.feePolicyVersion.update({
      where: { id: externalPolicy.id },
      data: {
        status: 'ACTIVE',
        publishedByUserId: externalAuthor.id,
        publishedAt: new Date(),
      },
    });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
      expect(
        await prisma.feePolicyVersion.findUnique({ where: { id: externalPolicy.id } }),
      ).toMatchObject({
        status: 'ACTIVE',
        publicVersion: 1,
        createdByUserId: externalAuthor.id,
      });
      expect(
        await prisma.feePolicyVersion.findUnique({ where: { id: DEMO_FEE_POLICY.id } }),
      ).toBeNull();
    } finally {
      await cleanupIntegrationDatabase();
      await runDemoCommand(['seed'], env);
      await runDemoCommand(['verify'], env);
    }
  });

  it('verifies the demo namespace while a publishable external product is interleaved', async () => {
    const suffix = crypto.randomUUID();
    const objectKey = `external/${suffix}.png`;
    const body = Buffer.from('external-product-image');
    const user = await prisma.user.create({
      data: externalUser(crypto.randomUUID(), `external-catalog-${suffix}@example.test`),
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId: user.id, storeName: 'External Store', slug: `external-store-${suffix}` },
    });
    const category = await prisma.catalogCategory.create({
      data: { slug: `external-category-${suffix}`, name: 'External Category' },
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
        listingTier: 'SILVER',
        sourceListingDraftId: draft.id,
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'GAME',
        model: 'NORMAL',
        status: 'ACTIVE',
        slug: `external-product-${suffix}`,
        title: 'External Product',
        description: 'Legitimate external catalog sentinel.',
        price: 42,
        stock: 3,
        createdAt: new Date('2026-01-18T12:00:00.000Z'),
        updatedAt: new Date('2026-01-18T12:00:00.000Z'),
        variants: { create: { title: 'External option', price: 42, stock: 3 } },
        images: {
          create: {
            objectKey,
            status: 'READY',
            contentType: 'image/png',
            sizeBytes: body.length,
            altText: 'External Product',
            sortOrder: 0,
            isCover: true,
            uploadedAt: new Date(),
            uploadExpiresAt: new Date('2099-01-01'),
          },
        },
      },
    });
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: user.id,
        sellerProfileId: seller.id,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `LIT-${crypto.randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: user.id,
        sellerProfileId: seller.id,
        subtotalAmountMinor: 4200n,
        totalAmountMinor: 4200n,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const orderItem = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        sourceProductId: product.id,
        sourceProductVersion: product.version,
        sellerProfileId: seller.id,
        sellerStoreName: seller.storeName,
        sellerSlug: seller.slug,
        productSlug: product.slug,
        productTitle: product.title,
        productType: product.productType,
        productModel: product.model,
        deliveryMode: product.deliveryMode,
        unitAmountMinor: 4200n,
        quantity: 1,
        lineTotalAmountMinor: 4200n,
      },
    });
    const reservation = await prisma.inventoryReservation.create({
      data: {
        orderId: order.id,
        orderItemId: orderItem.id,
        productId: product.id,
        quantity: 1,
        expiresAt: order.expiresAt,
      },
    });
    const event = await prisma.orderEvent.create({
      data: { orderId: order.id, type: 'ORDER_CREATED' },
    });
    const outbox = await prisma.outboxEvent.create({
      data: {
        orderEventId: event.id,
        aggregateType: 'ORDER',
        aggregateId: order.id,
        eventType: 'ORDER_CREATED',
        payload: { orderId: order.id },
      },
    });
    const idempotency = await prisma.commerceIdempotencyRecord.create({
      data: {
        actorUserId: user.id,
        operation: 'CHECKOUT_CREATE',
        keyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
        responseStatus: 201,
        responseBody: { orderCode: order.publicCode },
        resourceType: 'ORDER',
        resourceId: order.id,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    try {
      await s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: objectKey,
          Body: body,
          ContentType: 'image/png',
        }),
      );

      await expect(runDemoCommand(['seed'], env)).resolves.toMatchObject(DEMO_SUMMARY);
      await expect(runDemoCommand(['verify'], env)).resolves.toMatchObject(DEMO_SUMMARY);
      await expect(runDemoCommand(['seed'], env)).resolves.toMatchObject(DEMO_SUMMARY);
      await expect(runDemoCommand(['verify'], env)).resolves.toMatchObject(DEMO_SUMMARY);
      expect(await prisma.product.findUnique({ where: { id: product.id } })).toMatchObject({
        slug: product.slug,
        title: product.title,
        price: product.price,
        stock: product.stock,
      });
      expect(await s3.send(new GetObjectCommand({ Bucket: bucket, Key: objectKey }))).toBeDefined();
      expect(
        await prisma.product.count({
          where: {
            slug: {
              in: DEMO_PRODUCTS.filter((item) => item.status === 'ACTIVE').map((item) => item.slug),
            },
          },
        }),
      ).toBe(6);
      await runDemoCommand(['reset', '--confirm'], env);
      expect(await prisma.product.findUnique({ where: { id: product.id } })).not.toBeNull();
      const preservedObject = await s3.send(
        new GetObjectCommand({ Bucket: bucket, Key: objectKey }),
      );
      expect(await bytes(preservedObject.Body)).toEqual(body);
      expect(await prisma.cart.findUnique({ where: { id: cart.id } })).not.toBeNull();
      expect(await prisma.order.findUnique({ where: { id: order.id } })).not.toBeNull();
      expect(await prisma.orderItem.findUnique({ where: { id: orderItem.id } })).not.toBeNull();
      expect(
        await prisma.inventoryReservation.findUnique({ where: { id: reservation.id } }),
      ).not.toBeNull();
      expect(await prisma.orderEvent.findUnique({ where: { id: event.id } })).not.toBeNull();
      expect(await prisma.outboxEvent.findUnique({ where: { id: outbox.id } })).not.toBeNull();
      expect(
        await prisma.commerceIdempotencyRecord.findUnique({ where: { id: idempotency.id } }),
      ).not.toBeNull();
    } finally {
      await prisma.outboxEvent.deleteMany({ where: { id: outbox.id } });
      await prisma.orderEvent.deleteMany({ where: { id: event.id } });
      await prisma.commerceIdempotencyRecord.deleteMany({ where: { id: idempotency.id } });
      await prisma.inventoryReservation.deleteMany({ where: { id: reservation.id } });
      await prisma.orderItem.deleteMany({ where: { id: orderItem.id } });
      await prisma.order.deleteMany({ where: { id: order.id } });
      await prisma.cart.deleteMany({ where: { id: cart.id } });
      await prisma.productImage.deleteMany({ where: { productId: product.id } });
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      await prisma.product.deleteMany({ where: { id: product.id } });
      await prisma.listingDraft.deleteMany({ where: { id: draft.id } });
      await prisma.catalogCategory.deleteMany({ where: { id: category.id } });
      await prisma.sellerProfile.deleteMany({ where: { id: seller.id } });
      await prisma.user.deleteMany({ where: { id: user.id } });
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
      await expect(runDemoCommand(['seed'], env)).resolves.toMatchObject(DEMO_SUMMARY);
      await expect(runDemoCommand(['verify'], env)).resolves.toMatchObject(DEMO_SUMMARY);
    }
  });

  it('restores relational drift and removes unexpected demo children', async () => {
    expect(
      await prisma.catalogCategory.count({
        where: { id: { in: DEMO_CATEGORIES.map((category) => category.id) } },
      }),
    ).toBe(DEMO_CATEGORIES.length);
    await prisma.catalogCategory.update({
      where: { id: DEMO_CATEGORIES[0].id },
      data: { name: 'drift' },
    });
    await prisma.product.update({
      where: { id: DEMO_PRODUCTS[0].id },
      data: { title: 'drift', status: 'PAUSED' },
    });
    await prisma.sellerProfile.update({
      where: { id: DEMO_IDS.sellerProfile },
      data: { description: 'drift' },
    });
    await prisma.productVariant.create({
      data: { productId: DEMO_PRODUCTS[0].id, title: 'extra', price: 1, stock: 1 },
    });
    await prisma.userRoleAssignment.deleteMany({ where: { userId: DEMO_USERS[1].id } });
    await prisma.userRoleAssignment.create({ data: { userId: DEMO_USERS[1].id, role: 'ADMIN' } });
    await prisma.catalogSubcategory.update({
      where: { id: DEMO_CATEGORIES[0].subcategories[0].id },
      data: { sortOrder: 99 },
    });
    await prisma.productVariant.update({
      where: { id: DEMO_PRODUCTS[2].variants[0].id },
      data: { price: 999, status: 'PAUSED' },
    });
    await prisma.product.update({
      where: { id: DEMO_PRODUCTS[0].id },
      data: { categoryId: DEMO_CATEGORIES[1].id, autoMessage: 'drift' },
    });
    await prisma.listingDraft.update({
      where: { id: DEMO_PRODUCTS[0].draftId },
      data: { notifyBrowser: true, autoMessage: 'drift' },
    });
    await prisma.productServiceDetails.update({
      where: { productId: DEMO_PRODUCTS[4].id },
      data: { basePrice: 999 },
    });
    await prisma.listingDraftServiceDetails.update({
      where: { draftId: DEMO_PRODUCTS[5].draftId },
      data: { notes: 'drift' },
    });
    await prisma.productImage.update({
      where: { id: DEMO_PRODUCTS[0].imageId },
      data: { altText: 'drift', sortOrder: 99 },
    });
    await prisma.productAccountDetails.update({
      where: { productId: DEMO_PRODUCTS[0].id },
      data: { warrantyNote: 'drift' },
    });
    await runDemoCommand(['seed'], env);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await prisma.productVariant.count({ where: { productId: DEMO_PRODUCTS[0].id } })).toBe(
      1,
    );
  });

  it('preserves external sentinels and resets repeatedly', async () => {
    const sentinel = await prisma.catalogCategory.create({
      data: { slug: 'integration-sentinel', name: 'Sentinel' },
    });
    const eventsBefore = await prisma.securityEvent.count();
    expect(await runDemoCommand(['reset', '--confirm'], env)).toMatchObject({
      ok: true,
      action: 'reset',
    });
    expect(
      await prisma.feePolicyVersion.findUnique({ where: { id: DEMO_FEE_POLICY.id } }),
    ).toMatchObject({ status: 'ACTIVE' });
    expect(
      await prisma.user.findUnique({ where: { id: DEMO_FEE_POLICY.author.id } }),
    ).toMatchObject({ email: DEMO_FEE_POLICY.author.email });
    expect(await prisma.catalogCategory.findUnique({ where: { id: sentinel.id } })).not.toBeNull();
    expect(await prisma.securityEvent.count()).toBe(eventsBefore);
    expect(await runDemoCommand(['reset', '--confirm'], env)).toMatchObject({
      ok: true,
      action: 'reset',
    });
    await prisma.catalogCategory.delete({ where: { id: sentinel.id } });
  });

  it('removes a demo buyer cart and remains idempotent across two resets', async () => {
    await runDemoCommand(['seed'], env);
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: DEMO_USERS[0].id,
        sellerProfileId: DEMO_IDS.sellerProfile,
      },
    });
    await prisma.cartItem.create({
      data: { cartId: cart.id, productId: DEMO_PRODUCTS[0].id, quantity: 1 },
    });
    await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
      ok: true,
      action: 'reset',
    });
    expect(await prisma.cart.findUnique({ where: { id: cart.id } })).toBeNull();
    await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
      ok: true,
      action: 'reset',
    });
  });

  it('removes every demo order artifact in dependency order across two resets', async () => {
    await runDemoCommand(['seed'], env);
    const product = await prisma.product.findUniqueOrThrow({ where: { id: DEMO_PRODUCTS[0].id } });
    const cart = await prisma.cart.create({
      data: {
        buyerUserId: DEMO_USERS[0].id,
        sellerProfileId: DEMO_IDS.sellerProfile,
        status: 'CHECKED_OUT',
        checkedOutAt: new Date(),
      },
    });
    const order = await prisma.order.create({
      data: {
        publicCode: `LIT-${crypto.randomUUID().replaceAll('-', '').slice(0, 14).toUpperCase()}`,
        sourceCartId: cart.id,
        sourceCartVersion: 1,
        buyerUserId: DEMO_USERS[0].id,
        sellerProfileId: DEMO_IDS.sellerProfile,
        subtotalAmountMinor: 1000n,
        totalAmountMinor: 1000n,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const item = await prisma.orderItem.create({
      data: {
        orderId: order.id,
        sourceProductId: product.id,
        sourceProductVersion: product.version,
        sellerProfileId: DEMO_IDS.sellerProfile,
        sellerStoreName: 'Demo',
        sellerSlug: 'demo',
        productSlug: product.slug,
        productTitle: product.title,
        productType: product.productType,
        productModel: product.model,
        deliveryMode: product.deliveryMode,
        unitAmountMinor: 1000n,
        quantity: 1,
        lineTotalAmountMinor: 1000n,
      },
    });
    await prisma.inventoryReservation.create({
      data: {
        orderId: order.id,
        orderItemId: item.id,
        productId: product.id,
        quantity: 1,
        expiresAt: order.expiresAt,
      },
    });
    const event = await prisma.orderEvent.create({
      data: { orderId: order.id, type: 'ORDER_CREATED' },
    });
    await prisma.outboxEvent.create({
      data: {
        orderEventId: event.id,
        aggregateType: 'ORDER',
        aggregateId: order.id,
        eventType: 'ORDER_CREATED',
        payload: { orderId: order.id },
      },
    });
    await prisma.commerceIdempotencyRecord.create({
      data: {
        actorUserId: DEMO_USERS[0].id,
        operation: 'CHECKOUT_CREATE',
        keyHash: crypto.randomUUID(),
        requestHash: crypto.randomUUID(),
        responseStatus: 201,
        responseBody: { orderCode: order.publicCode },
        resourceType: 'ORDER',
        resourceId: order.id,
        completedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
      ok: true,
      action: 'reset',
    });
    expect(await prisma.order.findUnique({ where: { id: order.id } })).toBeNull();
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.inventoryReservation.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.orderEvent.count({ where: { orderId: order.id } })).toBe(0);
    expect(await prisma.outboxEvent.count({ where: { aggregateId: order.id } })).toBe(0);
    expect(
      await prisma.commerceIdempotencyRecord.count({ where: { actorUserId: DEMO_USERS[0].id } }),
    ).toBe(0);
    await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
      ok: true,
      action: 'reset',
    });
  });

  it.each(['seller', 'product'] as const)(
    'fails closed for an external cart reference to a demo %s and recovers after removal',
    async (reference) => {
      await runDemoCommand(['seed'], env);
      const id = crypto.randomUUID();
      await prisma.user.create({ data: externalUser(id, `external-cart-${id}@example.test`) });
      let externalSellerId = DEMO_IDS.sellerProfile;
      if (reference === 'product') {
        const profile = await prisma.sellerProfile.create({
          data: { userId: id, storeName: 'External', slug: `external-${id}` },
        });
        externalSellerId = profile.id;
      }
      const cart = await prisma.cart.create({
        data: { buyerUserId: id, sellerProfileId: externalSellerId },
      });
      if (reference === 'product')
        await prisma.cartItem.create({
          data: { cartId: cart.id, productId: DEMO_PRODUCTS[0].id, quantity: 1 },
        });
      const productsBefore = await prisma.product.count({
        where: { id: { in: DEMO_PRODUCTS.map((product) => product.id) } },
      });
      const error = await runDemoCommand(['reset', '--confirm'], env).catch(
        (caught: unknown) => caught,
      );
      expect(error).toMatchObject({ code: 'DEMO_DATA_NAMESPACE_CONFLICT' });
      expect(String(error)).not.toMatch(/foreign key|constraint|@example\.test/i);
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
      expect(await prisma.cart.findUnique({ where: { id: cart.id } })).not.toBeNull();
      expect(
        await prisma.sellerProfile.findUnique({ where: { id: DEMO_IDS.sellerProfile } }),
      ).not.toBeNull();
      expect(
        await prisma.product.count({ where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } } }),
      ).toBe(productsBefore);
      await prisma.cart.delete({ where: { id: cart.id } });
      await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
        ok: true,
        action: 'reset',
      });
      await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
        ok: true,
        action: 'reset',
      });
      expect(await prisma.user.findUnique({ where: { id } })).not.toBeNull();
      await prisma.sellerProfile.deleteMany({ where: { userId: id } });
      await prisma.user.delete({ where: { id } });
    },
  );

  it('resets authentication relations after a real HTTP login and preserves its SecurityEvent', async () => {
    await runDemoCommand(['seed'], env);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .send({ email: DEMO_USERS[0].email, password: env.DEMO_USER_PASSWORD });
    expect([200, 202]).toContain(login.status);
    const device = await prisma.device.findFirst({ where: { userId: DEMO_USERS[0].id } });
    expect(device).not.toBeNull();
    const sessions = await prisma.session.findMany({
      where: { userId: DEMO_USERS[0].id },
      select: { id: true },
    });
    const sessionIds = sessions.map((session) => session.id);
    const event = await prisma.securityEvent.findFirst({
      where: { userId: DEMO_USERS[0].id },
      orderBy: { createdAt: 'desc' },
    });
    expect(event).not.toBeNull();
    const preserved = {
      eventType: event!.eventType,
      outcome: event!.outcome,
      metadata: event!.metadata,
      createdAt: event!.createdAt,
    };
    await expect(runDemoCommand(['reset', '--confirm'], env)).resolves.toMatchObject({
      ok: true,
      action: 'reset',
    });
    expect(await prisma.user.findUnique({ where: { id: DEMO_USERS[0].id } })).toBeNull();
    expect(await prisma.device.count({ where: { userId: DEMO_USERS[0].id } })).toBe(0);
    expect(await prisma.session.count({ where: { userId: DEMO_USERS[0].id } })).toBe(0);
    expect(
      await prisma.sessionRefreshToken.count({ where: { sessionId: { in: sessionIds } } }),
    ).toBe(0);
    expect(await prisma.verificationChallenge.count({ where: { userId: DEMO_USERS[0].id } })).toBe(
      0,
    );
    expect(await prisma.stepUpGrant.count({ where: { userId: DEMO_USERS[0].id } })).toBe(0);
    expect(
      await prisma.twoFactorSettings.findUnique({ where: { userId: DEMO_USERS[0].id } }),
    ).toBeNull();
    const retained = await prisma.securityEvent.findUnique({ where: { id: event!.id } });
    expect(retained).toMatchObject({ ...preserved, userId: null, sessionId: null, deviceId: null });
  });

  it.each([
    ['reserved email', crypto.randomUUID(), DEMO_USERS[0].email],
    ['reserved UUID', DEMO_USERS[0].id, 'external-reserved-id@example.test'],
  ])('refuses a namespace conflict by %s without overwriting it', async (_case, id, email) => {
    await runDemoCommand(['reset', '--confirm'], env);
    await prisma.user.create({ data: externalUser(id, email) });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
      expect(await prisma.user.findUnique({ where: { id } })).toMatchObject({
        id,
        email,
        termsVersion: 'external',
      });
    } finally {
      await prisma.user.delete({ where: { id } });
    }
  });

  it('refuses seller profile slug and seller application unique-relation conflicts', async () => {
    await runDemoCommand(['reset', '--confirm'], env);
    const externalId = crypto.randomUUID();
    await prisma.user.create({ data: externalUser(externalId, 'external-profile@example.test') });
    await prisma.sellerProfile.create({
      data: { userId: externalId, slug: 'demo-lit-store', storeName: 'External' },
    });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
    } finally {
      await prisma.sellerProfile.delete({ where: { userId: externalId } });
      await prisma.user.delete({ where: { id: externalId } });
    }
    await prisma.user.create({ data: externalUser(DEMO_IDS.users.seller, DEMO_USERS[1].email) });
    const otherProfile = await prisma.sellerProfile.create({
      data: {
        userId: DEMO_IDS.users.seller,
        slug: 'external-seller-profile',
        storeName: 'External',
      },
    });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
    } finally {
      await prisma.sellerProfile.delete({ where: { id: otherProfile.id } });
    }
    const application = await prisma.sellerApplication.create({
      data: { userId: DEMO_IDS.users.seller, storeName: 'External', requestedSlug: 'external' },
    });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
    } finally {
      await prisma.sellerApplication.delete({ where: { id: application.id } });
      await prisma.user.delete({ where: { id: DEMO_IDS.users.seller } });
    }
  });

  it('refuses a reserved draft materialized by an external product', async () => {
    await runDemoCommand(['seed'], env);
    const expected = DEMO_PRODUCTS[0];
    await prisma.productImage.deleteMany({ where: { productId: expected.id } });
    await prisma.productVariant.deleteMany({ where: { productId: expected.id } });
    await prisma.productAccountDetails.deleteMany({ where: { productId: expected.id } });
    await prisma.product.delete({ where: { id: expected.id } });
    const external = await prisma.product.create({
      data: {
        listingTier: 'SILVER',
        sourceListingDraftId: expected.draftId,
        sellerProfileId: DEMO_IDS.sellerProfile,
        categoryId: expected.categoryId,
        subcategoryId: expected.subcategoryId,
        productType: expected.productType,
        model: expected.model,
        status: 'UNPUBLISHED',
        slug: 'external-materialization',
        title: 'External',
        description: 'External sentinel',
      },
    });
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
      expect(await prisma.product.findUnique({ where: { id: external.id } })).toMatchObject({
        slug: 'external-materialization',
      });
    } finally {
      await prisma.product.delete({ where: { id: external.id } });
      await runDemoCommand(['reset', '--confirm'], env);
    }
  });

  it('preserves an external MinIO sentinel and reuses an orphan canonical object', async () => {
    await runDemoCommand(['reset', '--confirm'], env);
    const key = 'external/integration-sentinel.png';
    const sentinel = Buffer.from('external-sentinel');
    await s3.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: sentinel, ContentType: 'image/png' }),
    );
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: DEMO_IMAGES[0].objectKey,
        Body: DEMO_IMAGES[0].body,
        ContentType: 'image/png',
      }),
    );
    await runDemoCommand(['seed'], env);
    await runDemoCommand(['verify'], env);
    await runDemoCommand(['reset', '--confirm'], env);
    const head = await s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    expect(head.ContentType).toBe('image/png');
    expect(await bytes(object.Body)).toEqual(sentinel);
    await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
  });

  it('refuses and preserves unknown bytes at a canonical MinIO key', async () => {
    await runDemoCommand(['reset', '--confirm'], env);
    const image = DEMO_IMAGES[0];
    const unknown = Buffer.from('unknown-demo-object');
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: image.objectKey,
        Body: unknown,
        ContentType: 'image/png',
      }),
    );
    try {
      await expect(runDemoCommand(['seed'], env)).rejects.toMatchObject({
        code: 'DEMO_DATA_NAMESPACE_CONFLICT',
      });
      const object = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: image.objectKey }));
      expect(await bytes(object.Body)).toEqual(unknown);
      expect(
        await prisma.user.count({ where: { id: { in: DEMO_USERS.map((user) => user.id) } } }),
      ).toBe(0);
    } finally {
      await s3.send(new DeleteObjectCommand({ Bucket: bucket, Key: image.objectKey }));
    }
  });
});
