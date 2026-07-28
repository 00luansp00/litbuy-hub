import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { SecurityEventType } from '@prisma/client';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import type { AppConfig } from '../src/config/app.config';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import { RedisService } from '../src/redis/redis.service';

describe('Product lifecycle HTTP with real auth and PostgreSQL', () => {
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

  async function actor(sellerRole = true, profileStatus: 'ACTIVE' | 'SUSPENDED' = 'ACTIVE') {
    const email = `lifecycle-http-${crypto.randomUUID()}@example.test`;
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
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    if (sellerRole)
      await prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'SELLER' } });
    const profile = sellerRole
      ? await prisma.sellerProfile.create({
          data: {
            userId: user.id,
            storeName: 'Lifecycle',
            slug: `store-${crypto.randomUUID()}`,
            status: profileStatus,
          },
        })
      : null;
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(200);
    const cookies = login.headers['set-cookie'] as unknown as string[];
    const csrf = cookies
      .map((cookie) => cookie.split(';')[0])
      .find((cookie) => cookie.startsWith('litbuy_csrf='))!
      .split('=')[1];
    return {
      user,
      profile,
      authorization: `Bearer ${login.body.accessToken as string}`,
      cookies,
      csrf,
    };
  }
  async function fixture() {
    const owner = await actor();
    const suffix = crypto.randomUUID();
    const category = await prisma.catalogCategory.create({
      data: { name: 'Lifecycle', slug: `category-${suffix}` },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: owner.profile!.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        status: 'APPROVED',
        title: 'Produto',
        description: 'Descrição',
        price: 10,
        stock: 0,
      },
    });
    const product = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: owner.profile!.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        slug: `product-${suffix}`,
        title: 'Produto',
        description: 'Descrição',
        price: 10,
        stock: 0,
        variants: { create: { title: 'Padrão', price: 10, stock: 0, status: 'ACTIVE' } },
        images: {
          create: {
            objectKey: `private/${suffix}`,
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
    return { owner, product };
  }
  const endpoint = (id: string) => `/api/v1/seller/products/${id}/lifecycle`;
  const patch = (owner: Awaited<ReturnType<typeof actor>>, id: string, body: object) =>
    request(app.getHttpServer())
      .patch(endpoint(id))
      .set('Authorization', owner.authorization)
      .set('Cookie', owner.cookies)
      .set('X-CSRF-Token', owner.csrf)
      .send(body);

  it('requires authentication, SELLER role, active profile and valid CSRF', async () => {
    const f = await fixture();
    await request(app.getHttpServer())
      .patch(endpoint(f.product.id))
      .send({ action: 'ACTIVATE', expectedVersion: 1 })
      .expect(401);
    const buyer = await actor(false);
    await patch(buyer, f.product.id, { action: 'ACTIVATE', expectedVersion: 1 }).expect(403);
    await request(app.getHttpServer())
      .patch(endpoint(f.product.id))
      .set('Authorization', f.owner.authorization)
      .set('Cookie', f.owner.cookies)
      .send({ action: 'ACTIVATE', expectedVersion: 1 })
      .expect(401);
    const suspended = await actor(true, 'SUSPENDED');
    await patch(suspended, crypto.randomUUID(), { action: 'ACTIVATE', expectedVersion: 1 }).expect(
      403,
    );
  });
  it('rejects invalid UUIDs and strict DTO violations before persistence', async () => {
    const f = await fixture();
    await patch(f.owner, 'not-a-uuid', { action: 'ACTIVATE', expectedVersion: 1 }).expect(400);
    for (const body of [
      { action: 'ACTIVATE', expectedVersion: 1, status: 'ACTIVE' },
      { action: 'ACTIVATE', expectedVersion: 1, unknown: true },
      { action: 'BAD', expectedVersion: 1 },
      { action: 'ACTIVATE' },
      { action: 'ACTIVATE', expectedVersion: 0 },
      { action: 'ACTIVATE', expectedVersion: -1 },
      { action: 'ACTIVATE', expectedVersion: 1.5 },
      { action: 'ACTIVATE', expectedVersion: '1' },
    ])
      await patch(f.owner, f.product.id, body).expect(400);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({
      status: 'UNPUBLISHED',
      version: 1,
    });
  });
  it('protects IDOR and nonexistent products with the same response', async () => {
    const own = await fixture();
    const other = await actor();
    for (const id of [own.product.id, crypto.randomUUID()]) {
      const response = await patch(other, id, { action: 'ACTIVATE', expectedVersion: 1 }).expect(
        404,
      );
      expect(response.body.code).toBe('PRODUCT_NOT_FOUND');
      expect(JSON.stringify(response.body)).not.toContain(own.owner.profile!.id);
    }
  });
  it('persists transitions, conflict and idempotency with safe responses and one event', async () => {
    const f = await fixture();
    const activated = await patch(f.owner, f.product.id, {
      action: 'ACTIVATE',
      expectedVersion: 1,
    }).expect(200);
    expect(activated.body).toMatchObject({
      id: f.product.id,
      status: 'ACTIVE',
      version: 2,
      changed: true,
    });
    expect(JSON.stringify(activated.body)).not.toMatch(
      /objectKey|viewUrl|storage|stack|token|cookie|header/i,
    );
    const retry = await patch(f.owner, f.product.id, {
      action: 'ACTIVATE',
      expectedVersion: 1,
    }).expect(200);
    expect(retry.body).toMatchObject({ status: 'ACTIVE', version: 2, changed: false });
    await patch(f.owner, f.product.id, { action: 'PAUSE', expectedVersion: 1 }).expect(409);
    await patch(f.owner, f.product.id, { action: 'PAUSE', expectedVersion: 2 }).expect(200);
    await patch(f.owner, f.product.id, { action: 'RESUME', expectedVersion: 3 }).expect(200);
    await patch(f.owner, f.product.id, { action: 'REMOVE', expectedVersion: 4 }).expect(200);
    await patch(f.owner, f.product.id, { action: 'ACTIVATE', expectedVersion: 5 }).expect(409);
    expect(await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject({
      status: 'REMOVED',
      version: 5,
    });
    const lifecycleEventTypes = [
      SecurityEventType.PRODUCT_ACTIVATED,
      SecurityEventType.PRODUCT_PAUSED,
      SecurityEventType.PRODUCT_RESUMED,
      SecurityEventType.PRODUCT_REMOVED,
    ];
    const lifecycleEvents = (
      await prisma.securityEvent.findMany({
        where: {
          userId: f.owner.user.id,
          eventType: { in: lifecycleEventTypes },
        },
        select: { eventType: true, metadata: true },
      })
    ).filter(
      (event) =>
        event.metadata !== null &&
        typeof event.metadata === 'object' &&
        !Array.isArray(event.metadata) &&
        event.metadata.productId === f.product.id,
    );
    expect(lifecycleEvents).toHaveLength(4);
    expect(lifecycleEvents.map((event) => event.eventType).sort()).toEqual(
      [...lifecycleEventTypes].sort(),
    );
  });
});
