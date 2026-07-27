import cookieParser from 'cookie-parser';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AuthMailer } from '../src/auth/auth.service';
import type { AppConfig } from '../src/config/app.config';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';

const password = 'integration password 123';
describe('Product images HTTP with real auth, PostgreSQL and MinIO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: AuthMailer;
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
  });
  afterAll(() => app.close());
  async function seller(label: string, role: 'SELLER' | 'ADMIN' = 'SELLER') {
    const email = `image-${label}-${crypto.randomUUID()}@example.test`;
    const registration = await request(app.getHttpServer())
      .post('/api/v1/auth/register')
      .send({
        email,
        password,
        birthDate: '2000-01-01',
        termsAccepted: true,
        privacyAccepted: true,
        termsVersion: process.env.CURRENT_TERMS_VERSION,
        privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
      })
      .expect(201);
    const token = mailer.sent.find(
      (x) => x.to === email && x.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRoleAssignment.create({ data: { userId: user.id, role } });
    let profile;
    if (role === 'SELLER')
      profile = await prisma.sellerProfile.create({
        data: {
          userId: user.id,
          storeName: `Store ${label}`,
          slug: `store-${crypto.randomUUID()}`,
          status: 'ACTIVE',
        },
      });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(200);
    return { user, profile, auth: `Bearer ${login.body.accessToken as string}` };
  }
  async function product(label: string) {
    const actor = await seller(label);
    const category = await prisma.catalogCategory.create({
      data: { slug: `cat-${crypto.randomUUID()}`, name: 'Images' },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: actor.profile!.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        status: 'APPROVED',
        title: 'Product',
        description: 'Description',
      },
    });
    const item = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: actor.profile!.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        slug: `product-${crypto.randomUUID()}`,
        title: 'Product',
        description: 'Description',
        status: 'UNPUBLISHED',
      },
    });
    return { ...actor, product: item };
  }
  const images = (id: string) => `/api/v1/seller/products/${id}/images`;
  it('enforces authentication, role and UUID pipes', async () => {
    const p = await product('security');
    await request(app.getHttpServer()).get(images(p.product.id)).expect(401);
    const buyer = await seller('buyer', 'ADMIN');
    await request(app.getHttpServer())
      .get(images(p.product.id))
      .set('Authorization', buyer.auth)
      .expect(403);
    await request(app.getHttpServer())
      .get('/api/v1/seller/products/not-uuid/images')
      .set('Authorization', p.auth)
      .expect(400);
  });
  it.each([
    ['image/jpeg', 1, 201],
    ['image/png', 1, 201],
    ['image/webp', 1, 201],
    ['image/svg+xml', 1, 400],
    ['image/gif', 1, 400],
    ['application/octet-stream', 1, 400],
    ['image/png', 0, 400],
    ['image/png', 5 * 1024 * 1024 + 1, 400],
  ] as const)('validates intent %s size %d', async (type, size, status) => {
    const p = await product(`validation-${type}-${size}`);
    const response = await request(app.getHttpServer())
      .post(`${images(p.product.id)}/upload-intents`)
      .set('Authorization', p.auth)
      .send({ contentType: type, sizeBytes: size })
      .expect(status);
    if (status === 201) {
      expect(response.body.headers).toEqual({ 'Content-Type': type, 'If-None-Match': '*' });
      expect(response.body.uploadUrl).not.toContain('minio:9000');
      expect(JSON.stringify(response.body)).not.toMatch(/objectKey|secret|bucket/i);
    }
  });
  it('protects ownership, active seller and product lifecycle without publishing', async () => {
    const own = await product('own');
    const other = await product('other');
    await request(app.getHttpServer())
      .get(images(other.product.id))
      .set('Authorization', own.auth)
      .expect(404);
    await prisma.sellerProfile.update({
      where: { id: own.profile!.id },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get(images(own.product.id))
      .set('Authorization', own.auth)
      .expect(404);
    await prisma.sellerProfile.update({
      where: { id: own.profile!.id },
      data: { status: 'ACTIVE' },
    });
    for (const status of ['ACTIVE', 'PAUSED', 'REMOVED'] as const) {
      await prisma.product.update({ where: { id: own.product.id }, data: { status } });
      await request(app.getHttpServer())
        .post(`${images(own.product.id)}/upload-intents`)
        .set('Authorization', own.auth)
        .send({ contentType: 'image/png', sizeBytes: 1 })
        .expect(409);
    }
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: other.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });
  it('runs PUT, complete, seller/admin list, cover, reorder and DELETE through HTTP', async () => {
    const p = await product('flow');
    const create = () =>
      request(app.getHttpServer())
        .post(`${images(p.product.id)}/upload-intents`)
        .set('Authorization', p.auth)
        .send({ contentType: 'image/png', sizeBytes: 5 })
        .expect(201);
    const one = await create();
    const put = await fetch(one.body.uploadUrl, {
      method: 'PUT',
      headers: one.body.headers,
      body: Buffer.from('first'),
    });
    expect(put.ok).toBe(true);
    expect(
      (
        await fetch(one.body.uploadUrl, {
          method: 'PUT',
          headers: one.body.headers,
          body: Buffer.from('again'),
        })
      ).status,
    ).toBe(412);
    const complete = await request(app.getHttpServer())
      .post(`${images(p.product.id)}/${one.body.imageId}/complete`)
      .set('Authorization', p.auth)
      .expect(201);
    expect(complete.body).toMatchObject({ status: 'READY', isCover: true });
    await request(app.getHttpServer())
      .post(`${images(p.product.id)}/${one.body.imageId}/complete`)
      .set('Authorization', p.auth)
      .expect(201);
    const listed = await request(app.getHttpServer())
      .get(images(p.product.id))
      .set('Authorization', p.auth)
      .expect(200);
    expect(listed.body.items[0].viewUrl).not.toContain('minio:9000');
    expect(await (await fetch(listed.body.items[0].viewUrl)).text()).toBe('first');
    const two = await create();
    await fetch(two.body.uploadUrl, {
      method: 'PUT',
      headers: two.body.headers,
      body: Buffer.from('second'),
    });
    await request(app.getHttpServer())
      .post(`${images(p.product.id)}/${two.body.imageId}/complete`)
      .set('Authorization', p.auth)
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${images(p.product.id)}/${two.body.imageId}/cover`)
      .set('Authorization', p.auth)
      .expect(200);
    await request(app.getHttpServer())
      .patch(`${images(p.product.id)}/reorder`)
      .set('Authorization', p.auth)
      .send({ imageIds: [two.body.imageId, one.body.imageId] })
      .expect(200);
    const admin = await seller('admin', 'ADMIN');
    await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${p.product.id}/images`)
      .set('Authorization', admin.auth)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${p.product.id}/images`)
      .set('Authorization', p.auth)
      .expect(403);
    await request(app.getHttpServer())
      .delete(`${images(p.product.id)}/${two.body.imageId}`)
      .set('Authorization', p.auth)
      .expect(200);
    expect(
      (await prisma.productImage.findUniqueOrThrow({ where: { id: two.body.imageId } })).status,
    ).toBe('DELETED');
    const afterDelete = await request(app.getHttpServer())
      .get(images(p.product.id))
      .set('Authorization', p.auth);
    const afterItems = (afterDelete.body as { items: Array<{ id: string }> }).items;
    expect(afterItems.map((x) => x.id)).not.toContain(two.body.imageId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).status).toBe(
      'UNPUBLISHED',
    );
  });
  it('rejects duplicate and incomplete reorder sets', async () => {
    const p = await product('reorder');
    const intent = await request(app.getHttpServer())
      .post(`${images(p.product.id)}/upload-intents`)
      .set('Authorization', p.auth)
      .send({ contentType: 'image/png', sizeBytes: 1 })
      .expect(201);
    await request(app.getHttpServer())
      .patch(`${images(p.product.id)}/reorder`)
      .set('Authorization', p.auth)
      .send({ imageIds: [intent.body.imageId, intent.body.imageId] })
      .expect(400);
    await request(app.getHttpServer())
      .patch(`${images(p.product.id)}/reorder`)
      .set('Authorization', p.auth)
      .send({ imageIds: [] })
      .expect(400);
  });
});
