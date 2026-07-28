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
import { RedisService } from '../src/redis/redis.service';
import {
  PRODUCT_IMAGE_STORAGE,
  type ProductImageStorage,
} from '../src/product-images/product-image.storage';

const password = 'integration password 123';
describe('Product images HTTP with real auth, PostgreSQL and MinIO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: AuthMailer;
  let redis: RedisService;
  let storage: ProductImageStorage;
  const objectKeys = new Set<string>();
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
    storage = app.get<ProductImageStorage>(PRODUCT_IMAGE_STORAGE);
  });
  beforeEach(async () => {
    await (await redis.getClient()).flushdb();
    mailer.send = AuthMailer.prototype.send.bind(mailer);
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
  });
  afterEach(async () => {
    const cleanup = await Promise.allSettled(
      [...objectKeys].map((key) => storage.deleteObject(key)),
    );
    objectKeys.clear();
    const unexpected = cleanup.find((result) => result.status === 'rejected');
    if (unexpected?.status === 'rejected') throw unexpected.reason;
  });
  afterAll(() => app.close());
  async function registerVerifiedUser(label: string) {
    void label;
    const email = `image-${crypto.randomUUID()}@example.test`;
    const registration = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
      email,
      password,
      birthDate: '2000-01-01',
      termsAccepted: true,
      privacyAccepted: true,
      termsVersion: process.env.CURRENT_TERMS_VERSION,
      privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
    });
    if (registration.status !== 201)
      throw new Error(
        `Registration failed: ${registration.status} ${JSON.stringify(registration.body)}`,
      );
    expect(registration.status).toBe(201);
    const token = mailer.sent.find(
      (x) => x.to === email && x.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const login = await request(app.getHttpServer())
      .post('/api/v1/auth/login')
      .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
      .send({ email, password })
      .expect(200);
    return { user, auth: `Bearer ${login.body.accessToken as string}` };
  }
  async function activeSeller(label: string) {
    const actor = await registerVerifiedUser(label);
    await prisma.userRoleAssignment.create({ data: { userId: actor.user.id, role: 'SELLER' } });
    const profile = await prisma.sellerProfile.create({
      data: {
        userId: actor.user.id,
        storeName: `Store ${label}`,
        slug: `store-${crypto.randomUUID()}`,
        status: 'ACTIVE',
      },
    });
    return { ...actor, profile };
  }
  async function adminUser(label: string) {
    const actor = await registerVerifiedUser(label);
    await prisma.userRoleAssignment.create({ data: { userId: actor.user.id, role: 'ADMIN' } });
    return actor;
  }
  async function product(label: string) {
    const actor = await activeSeller(label);
    const category = await prisma.catalogCategory.create({
      data: { slug: `cat-${crypto.randomUUID()}`, name: 'Images' },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: actor.profile.id,
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
        sellerProfileId: actor.profile.id,
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
  async function createUploadIntent(productId: string, auth: string, body: Buffer) {
    const response = await request(app.getHttpServer())
      .post(`${images(productId)}/upload-intents`)
      .set('Authorization', auth)
      .send({ contentType: 'image/png', sizeBytes: body.byteLength })
      .expect(201);
    const image = await prisma.productImage.findUniqueOrThrow({
      where: { id: response.body.imageId as string },
    });
    objectKeys.add(image.objectKey);
    return response;
  }
  async function createReadyImage(productId: string, auth: string, body: Buffer) {
    const created = await createUploadIntent(productId, auth, body);
    await putSignedObject(created.body.uploadUrl, created.body.headers, body);
    await request(app.getHttpServer())
      .post(`${images(productId)}/${created.body.imageId}/complete`)
      .set('Authorization', auth)
      .expect(201);
    return created.body.imageId as string;
  }
  async function putSignedObject(
    uploadUrl: string,
    signedHeaders: Record<string, string>,
    body: Buffer,
  ) {
    const headers = new Headers();
    for (const [name, value] of Object.entries(signedHeaders)) headers.set(name, value);
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers,
      body: body as unknown as BodyInit,
    });
    const responseBody = await response.text();
    if (!response.ok)
      throw new Error(
        `Signed PUT failed status=${response.status} body=${responseBody} host=${new URL(uploadUrl).host} headers=${JSON.stringify(Object.fromEntries(headers.entries()))}`,
      );
    return response;
  }
  it('enforces authentication, role and UUID pipes', async () => {
    const p = await product('security');
    await request(app.getHttpServer()).get(images(p.product.id)).expect(401);
    const buyer = await registerVerifiedUser('without-seller');
    expect(
      await prisma.userRoleAssignment.count({
        where: { userId: buyer.user.id, role: 'SELLER' },
      }),
    ).toBe(0);
    expect(await prisma.sellerProfile.count({ where: { userId: buyer.user.id } })).toBe(0);
    const forbidden = await request(app.getHttpServer())
      .get(images(p.product.id))
      .set('Authorization', buyer.auth);
    expect(forbidden.status).toBe(403);
    expect(forbidden.body.code).toBe('INSUFFICIENT_ROLE');
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
      where: { id: own.profile.id },
      data: { status: 'SUSPENDED' },
    });
    await request(app.getHttpServer())
      .get(images(own.product.id))
      .set('Authorization', own.auth)
      .expect(404);
    await prisma.sellerProfile.update({
      where: { id: own.profile.id },
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
  it('serializes concurrent HTTP intents at the eight-image limit with unique ordering', async () => {
    const p = await product('concurrency');
    const responses = await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer())
          .post(`${images(p.product.id)}/upload-intents`)
          .set('Authorization', p.auth)
          .send({ contentType: 'image/png', sizeBytes: 1 }),
      ),
    );
    expect(responses.filter((response) => response.status === 201)).toHaveLength(8);
    const blocked = responses.filter((response) => response.status === 409);
    expect(blocked).toHaveLength(2);
    expect(blocked.every((response) => response.body.code === 'PRODUCT_IMAGE_LIMIT_REACHED')).toBe(
      true,
    );
    const occupied = await prisma.productImage.findMany({
      where: { productId: p.product.id, status: { in: ['PENDING_UPLOAD', 'READY'] } },
    });
    expect(occupied).toHaveLength(8);
    expect(new Set(occupied.map((image) => image.sortOrder)).size).toBe(8);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).status).toBe(
      'UNPUBLISHED',
    );
  });
  it('runs PUT, complete, seller/admin list, cover, reorder and DELETE through HTTP', async () => {
    const p = await product('flow');
    const firstBody = Buffer.from('first');
    const one = await createUploadIntent(p.product.id, p.auth, firstBody);
    expect(one.body.headers).toEqual({ 'Content-Type': 'image/png', 'If-None-Match': '*' });
    expect(new URL(one.body.uploadUrl).host).toBe('localhost:9000');
    expect(one.body.uploadUrl).not.toContain('minio:9000');
    const put = await putSignedObject(one.body.uploadUrl, one.body.headers, firstBody);
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
    const secondBody = Buffer.from('second');
    const two = await createUploadIntent(p.product.id, p.auth, secondBody);
    await putSignedObject(two.body.uploadUrl, two.body.headers, secondBody);
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
    const admin = await adminUser('admin');
    await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${p.product.id}/images`)
      .set('Authorization', admin.auth)
      .expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/admin/products/${p.product.id}/images`)
      .set('Authorization', p.auth)
      .expect(403);
    const deletedObjectKey = (
      await prisma.productImage.findUniqueOrThrow({ where: { id: two.body.imageId } })
    ).objectKey;
    await request(app.getHttpServer())
      .delete(`${images(p.product.id)}/${two.body.imageId}`)
      .set('Authorization', p.auth)
      .expect(200);
    expect(
      (await prisma.productImage.findUniqueOrThrow({ where: { id: two.body.imageId } })).status,
    ).toBe('DELETED');
    expect(await storage.headObject(deletedObjectKey)).toBeNull();
    const afterDelete = await request(app.getHttpServer())
      .get(images(p.product.id))
      .set('Authorization', p.auth);
    const afterItems = (afterDelete.body as { items: Array<{ id: string }> }).items;
    expect(afterItems.map((x) => x.id)).not.toContain(two.body.imageId);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).status).toBe(
      'UNPUBLISHED',
    );
  });
  it('rejects an uploaded object whose size differs from the declared size', async () => {
    const p = await product('size-mismatch');
    const intent = await createUploadIntent(p.product.id, p.auth, Buffer.from('first'));
    await putSignedObject(intent.body.uploadUrl, intent.body.headers, Buffer.from('second'));
    const response = await request(app.getHttpServer())
      .post(`${images(p.product.id)}/${intent.body.imageId}/complete`)
      .set('Authorization', p.auth);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PRODUCT_IMAGE_UPLOAD_INVALID');
    const image = await prisma.productImage.findUniqueOrThrow({
      where: { id: intent.body.imageId },
    });
    expect(image).toMatchObject({ status: 'DELETED', isCover: false });
    expect(image.deletedAt).not.toBeNull();
    expect(await storage.headObject(image.objectKey)).toBeNull();
    expect(
      await prisma.securityEvent.count({
        where: {
          userId: p.user.id,
          eventType: 'PRODUCT_IMAGE_UPLOAD_REJECTED',
          outcome: 'BLOCKED',
        },
      }),
    ).toBe(1);
  });
  it('rejects image IDOR without changing the foreign image or product', async () => {
    const owner = await product('idor-owner');
    const attacker = await product('idor-attacker');
    const foreign = await createUploadIntent(owner.product.id, owner.auth, Buffer.from('owner'));
    const local = await createUploadIntent(
      attacker.product.id,
      attacker.auth,
      Buffer.from('local'),
    );
    const before = await prisma.productImage.findUniqueOrThrow({
      where: { id: foreign.body.imageId },
    });
    for (const [method, suffix] of [
      ['post', 'complete'],
      ['patch', 'cover'],
      ['delete', ''],
    ] as const) {
      const client = request(app.getHttpServer());
      const response = await client[method](
        `${images(attacker.product.id)}/${foreign.body.imageId}${suffix ? `/${suffix}` : ''}`,
      ).set('Authorization', attacker.auth);
      expect(response.status).toBe(404);
      expect(JSON.stringify(response.body)).not.toContain(owner.product.id);
      expect(JSON.stringify(response.body)).not.toContain(before.objectKey);
    }
    const reorder = await request(app.getHttpServer())
      .patch(`${images(attacker.product.id)}/reorder`)
      .set('Authorization', attacker.auth)
      .send({ imageIds: [local.body.imageId, foreign.body.imageId] });
    expect(reorder.status).toBe(400);
    expect(reorder.body.code).toBe('PRODUCT_IMAGE_ORDER_INVALID');
    expect(await prisma.productImage.findUniqueOrThrow({ where: { id: before.id } })).toMatchObject(
      {
        status: before.status,
        sortOrder: before.sortOrder,
        deletedAt: before.deletedAt,
      },
    );
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: owner.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });
  it('rejects duplicate, incomplete, and foreign reorder sets without changing order', async () => {
    const p = await product('reorder');
    const other = await product('reorder-other');
    const firstId = await createReadyImage(p.product.id, p.auth, Buffer.from('first'));
    const secondId = await createReadyImage(p.product.id, p.auth, Buffer.from('second'));
    const foreignId = await createReadyImage(other.product.id, other.auth, Buffer.from('foreign'));
    const original = await prisma.productImage.findMany({
      where: { productId: p.product.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sortOrder: true },
    });
    for (const imageIds of [[firstId, firstId], [firstId], [firstId, foreignId]]) {
      const response = await request(app.getHttpServer())
        .patch(`${images(p.product.id)}/reorder`)
        .set('Authorization', p.auth)
        .send({ imageIds });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('PRODUCT_IMAGE_ORDER_INVALID');
      expect(
        await prisma.productImage.findMany({
          where: { productId: p.product.id },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, sortOrder: true },
        }),
      ).toEqual(original);
    }
    expect(original.map((image) => image.id)).toEqual([firstId, secondId]);
    expect(
      await prisma.securityEvent.count({
        where: { userId: p.user.id, eventType: 'PRODUCT_IMAGES_REORDERED' },
      }),
    ).toBe(0);
  });
  it('rolls back every reorder update when PostgreSQL rejects the second image', async () => {
    const p = await product('reorder-rollback');
    const firstId = await createReadyImage(p.product.id, p.auth, Buffer.from('first'));
    const secondId = await createReadyImage(p.product.id, p.auth, Buffer.from('second'));
    const original = await prisma.productImage.findMany({
      where: { productId: p.product.id },
      orderBy: { sortOrder: 'asc' },
      select: { id: true, sortOrder: true },
    });
    const suffix = crypto.randomUUID().replaceAll('-', '');
    const functionName = `fail_product_image_reorder_${suffix}`;
    const triggerName = `fail_product_image_reorder_trigger_${suffix}`;
    await prisma.$executeRawUnsafe(`
      CREATE FUNCTION "${functionName}"() RETURNS trigger AS $$
      BEGIN
        IF NEW.id = '${secondId}'::uuid AND NEW."sortOrder" <> OLD."sortOrder" THEN
          RAISE EXCEPTION 'forced reorder rollback';
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql
    `);
    try {
      await prisma.$executeRawUnsafe(`
        CREATE TRIGGER "${triggerName}"
        BEFORE UPDATE ON "ProductImage"
        FOR EACH ROW EXECUTE FUNCTION "${functionName}"()
      `);
      const response = await request(app.getHttpServer())
        .patch(`${images(p.product.id)}/reorder`)
        .set('Authorization', p.auth)
        .send({ imageIds: [secondId, firstId] });
      expect(response.status).toBe(500);
      expect(
        await prisma.productImage.findMany({
          where: { productId: p.product.id },
          orderBy: { sortOrder: 'asc' },
          select: { id: true, sortOrder: true },
        }),
      ).toEqual(original);
      expect(
        await prisma.securityEvent.count({
          where: { userId: p.user.id, eventType: 'PRODUCT_IMAGES_REORDERED' },
        }),
      ).toBe(0);
    } finally {
      const dropTriggerSql = `DROP TRIGGER IF EXISTS "${triggerName}" ON "ProductImage"`;
      const dropFunctionSql = `DROP FUNCTION IF EXISTS "${functionName}"()`;
      try {
        await prisma.$executeRawUnsafe(dropTriggerSql);
      } finally {
        await prisma.$executeRawUnsafe(dropFunctionSql);
      }
    }
  });
  it('serializes concurrent cover changes and promotes the remaining READY image', async () => {
    const p = await product('cover-concurrency');
    const firstId = await createReadyImage(p.product.id, p.auth, Buffer.from('first'));
    const secondId = await createReadyImage(p.product.id, p.auth, Buffer.from('second'));
    const responses = await Promise.all([
      request(app.getHttpServer())
        .patch(`${images(p.product.id)}/${firstId}/cover`)
        .set('Authorization', p.auth),
      request(app.getHttpServer())
        .patch(`${images(p.product.id)}/${secondId}/cover`)
        .set('Authorization', p.auth),
    ]);
    expect(responses.every((response) => response.status === 200)).toBe(true);
    const ready = await prisma.productImage.findMany({
      where: { productId: p.product.id, status: 'READY' },
      orderBy: { sortOrder: 'asc' },
    });
    expect(ready).toHaveLength(2);
    expect(ready.filter((image) => image.isCover)).toHaveLength(1);
    const cover = ready.find((image) => image.isCover)!;
    const remaining = ready.find((image) => !image.isCover)!;
    await request(app.getHttpServer())
      .delete(`${images(p.product.id)}/${cover.id}`)
      .set('Authorization', p.auth)
      .expect(200);
    expect(
      await prisma.productImage.findUniqueOrThrow({ where: { id: remaining.id } }),
    ).toMatchObject({ status: 'READY', isCover: true });
    await request(app.getHttpServer())
      .delete(`${images(p.product.id)}/${remaining.id}`)
      .set('Authorization', p.auth)
      .expect(200);
    expect(
      await prisma.productImage.count({
        where: { productId: p.product.id, status: 'READY', isCover: true },
      }),
    ).toBe(0);
    expect((await prisma.product.findUniqueOrThrow({ where: { id: p.product.id } })).status).toBe(
      'UNPUBLISHED',
    );
  });
});
