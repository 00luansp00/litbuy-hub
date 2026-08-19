import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import type { AppConfig } from '../src/config/app.config';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Carts HTTP with real guards, sessions, CSRF and PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: AuthMailer;
  let redis: RedisService;
  const password = 'integration password 123';
  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = ref.createNestApplication();
    const config = app.get(ConfigService).getOrThrow<AppConfig>('app');
    app.setGlobalPrefix(config.apiPrefix);
    app.enableVersioning({ type: VersioningType.URI });
    app.use(cookieParser());
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    mailer = app.get(AuthMailer);
    redis = app.get(RedisService);
  });
  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });
  afterAll(() => app.close());
  async function actor() {
    const email = `cart-http-${crypto.randomUUID()}@example.test`;
    const registration = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password,
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    });
    const token = mailer.sent.find(
      (item) => item.to === email && item.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(200);
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const csrfCookie = cookies
      .map((cookie) => cookie.split(';')[0])
      .find((cookie) => cookie.startsWith('litbuy_csrf='));
    if (!csrfCookie) throw new Error('missing csrf cookie');
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    return {
      user,
      authorization: `Bearer ${String(login.body.accessToken)}`,
      cookies,
      csrf: csrfCookie.split('=')[1],
    };
  }
  async function catalog() {
    const suffix = crypto.randomUUID();
    const sellerUser = await prisma.user.create({
      data: {
        email: `cart-seller-${suffix}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId: sellerUser.id, storeName: 'Cart Store', slug: `cart-store-${suffix}` },
    });
    const category = await prisma.catalogCategory.create({
      data: { name: 'Cart', slug: `cart-category-${suffix}` },
    });
    const products = [];
    for (let index = 0; index < 2; index++) {
      const draft = await prisma.listingDraft.create({
        data: {
          sellerProfileId: seller.id,
          categoryId: category.id,
          productType: 'GAME',
          model: 'NORMAL',
          status: 'APPROVED',
        },
      });
      products.push(
        await prisma.product.create({
          data: {
            sourceListingDraftId: draft.id,
            sellerProfileId: seller.id,
            categoryId: category.id,
            productType: 'GAME',
            model: 'NORMAL',
            status: 'ACTIVE',
            slug: `cart-product-${index}-${suffix}`,
            title: `Product ${index}`,
            description: 'Public',
            price: 10 + index,
            stock: 20,
            variants: {
              create: { title: 'Canonical', price: 10 + index, stock: 20, status: 'ACTIVE' },
            },
            images: {
              create: {
                objectKey: `cart/${suffix}/${index}`,
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
        }),
      );
    }
    return { seller, products };
  }
  const headers = (identity: Awaited<ReturnType<typeof actor>>, csrf = true) => ({
    Authorization: identity.authorization,
    Cookie: identity.cookies,
    ...(csrf ? { 'X-CSRF-Token': identity.csrf } : {}),
  });
  it('uses real authentication and database-backed BUYER RBAC', async () => {
    const a = await actor();
    await request(app.getHttpServer()).get('/api/v1/carts').expect(401);
    await request(app.getHttpServer())
      .get('/api/v1/carts')
      .set('Authorization', a.authorization)
      .expect(200);
    await prisma.userRoleAssignment.delete({
      where: { userId_role: { userId: a.user.id, role: 'BUYER' } },
    });
    await prisma.userRoleAssignment.create({ data: { userId: a.user.id, role: 'ADMIN' } });
    await request(app.getHttpServer())
      .get('/api/v1/carts')
      .set('Authorization', a.authorization)
      .expect(403);
    await prisma.userRoleAssignment.create({ data: { userId: a.user.id, role: 'BUYER' } });
    await request(app.getHttpServer())
      .get('/api/v1/carts')
      .set('Authorization', a.authorization)
      .expect(200);
  });
  it('enforces persisted-session CSRF and rejects another session token', async () => {
    const a = await actor(),
      other = await actor(),
      c = await catalog();
    const endpoint = `/api/v1/carts/${c.seller.slug}/items`;
    const body = { productId: c.products[0].id, quantity: 1, expectedVersion: 0 };
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', a.authorization)
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(a, false))
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', 'wrong')
      .send(body)
      .expect(401);
    await request(app.getHttpServer())
      .post(endpoint)
      .set('Authorization', a.authorization)
      .set('Cookie', a.cookies)
      .set('X-CSRF-Token', other.csrf)
      .send(body)
      .expect(401);
    await request(app.getHttpServer()).post(endpoint).set(headers(a)).send(body).expect(201);
    const session = await prisma.session.findFirstOrThrow({ where: { userId: a.user.id } });
    expect(session.csrfTokenHash).not.toBe(a.csrf);
  });
  it('executes the real versioned flow and preserves the empty ACTIVE cart', async () => {
    const a = await actor(),
      c = await catalog();
    const endpoint = `/api/v1/carts/${c.seller.slug}/items`;
    const first = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(a))
      .send({ productId: c.products[0].id, quantity: 1, expectedVersion: 0 })
      .expect(201);
    expect(first.body.version).toBe(1);
    const second = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(a))
      .send({ productId: c.products[1].id, quantity: 1, expectedVersion: 1 })
      .expect(409);
    expect(second.body.code).toBe('CART_SINGLE_SKU_REQUIRED');
    const storedItems = await prisma.cartItem.findMany({
      where: { cart: { buyerUserId: a.user.id } },
      select: { id: true, productId: true },
    });
    const firstItem = storedItems.find(({ productId }) => productId === c.products[0].id);
    if (!firstItem) throw new Error('expected persisted cart item');
    const firstId = firstItem.id;
    await request(app.getHttpServer())
      .patch(`${endpoint}/${firstId}`)
      .set(headers(a))
      .send({ quantity: 2, expectedVersion: 1 })
      .expect(200)
      .expect(({ body }) => expect(body.version).toBe(2));
    await request(app.getHttpServer())
      .delete(`${endpoint}/${firstId}`)
      .set(headers(a))
      .send({ expectedVersion: 2 })
      .expect(200);
    const empty = await request(app.getHttpServer())
      .get(`/api/v1/carts/${c.seller.slug}`)
      .set(headers(a))
      .expect(200);
    expect(empty.body).toMatchObject({
      status: 'ACTIVE',
      version: 3,
      items: [],
      previewSubtotalMinor: null,
      checkoutReady: false,
    });
    expect(await prisma.cart.count({ where: { buyerUserId: a.user.id, status: 'ACTIVE' } })).toBe(
      1,
    );
  });
  it('protects IDOR, strict validation, hidden products and private response fields', async () => {
    const a = await actor(),
      b = await actor(),
      c = await catalog();
    const endpoint = `/api/v1/carts/${c.seller.slug}/items`;
    const created = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(b))
      .send({ productId: c.products[0].id, quantity: 1, expectedVersion: 0 })
      .expect(201);
    const itemId = String(created.body.items[0].id);
    await request(app.getHttpServer())
      .get(`/api/v1/carts/${c.seller.slug}`)
      .set('Authorization', a.authorization)
      .expect(404);
    await request(app.getHttpServer())
      .patch(`${endpoint}/${itemId}`)
      .set(headers(a))
      .send({ quantity: 2, expectedVersion: 1 })
      .expect(409);
    await request(app.getHttpServer())
      .delete(`${endpoint}/${itemId}`)
      .set(headers(a))
      .send({ expectedVersion: 1 })
      .expect(409);
    for (const body of [
      { productId: 'bad', quantity: 1, expectedVersion: 0 },
      { productId: crypto.randomUUID(), quantity: 0, expectedVersion: 0 },
      { productId: crypto.randomUUID(), quantity: -1, expectedVersion: 0 },
      { productId: crypto.randomUUID(), quantity: 1000, expectedVersion: 0 },
      { productId: crypto.randomUUID(), quantity: 1 },
      { productId: crypto.randomUUID(), quantity: 1, expectedVersion: 0, extra: true },
    ])
      await request(app.getHttpServer()).post(endpoint).set(headers(a)).send(body).expect(400);
    await prisma.product.update({ where: { id: c.products[1].id }, data: { status: 'PAUSED' } });
    const hidden = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(a))
      .send({ productId: c.products[1].id, quantity: 1, expectedVersion: 0 })
      .expect(422);
    const missing = await request(app.getHttpServer())
      .post(endpoint)
      .set(headers(a))
      .send({ productId: crypto.randomUUID(), quantity: 1, expectedVersion: 0 })
      .expect(422);
    expect({
      status: hidden.status,
      code: hidden.body.code,
      message: hidden.body.message,
      details: hidden.body.details,
    }).toEqual({
      status: missing.status,
      code: missing.body.code,
      message: missing.body.message,
      details: missing.body.details,
    });
    const serialized = JSON.stringify(created.body);
    for (const field of [
      'objectKey',
      'accountDetails',
      'recoveryLevel',
      'recoveryRisk',
      'warrantyNote',
      'buyerRequirements',
      'notes',
      'autoMessage',
      'password',
      'csrfTokenHash',
      'sessionId',
    ])
      expect(serialized).not.toContain(field);
  });
});
