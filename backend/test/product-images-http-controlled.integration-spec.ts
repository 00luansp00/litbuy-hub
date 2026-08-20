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
import {
  PRODUCT_IMAGE_STORAGE,
  type ProductImageStorage,
} from '../src/product-images/product-image.storage';
import { RedisService } from '../src/redis/redis.service';

const password = 'integration password 123';
const future = () => new Date(Date.now() + 300_000);
function expectSafeHttpPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  expect(serialized).not.toMatch(/objectKey|secretAccessKey|accessKeyId|minio:9000|stack/i);
  expect(serialized).not.toContain('signing failed');
  expect(serialized).not.toContain('storage unavailable');
}

function expectSafeAuditMetadata(metadata: unknown) {
  const serialized = JSON.stringify(metadata);
  expect(serialized).not.toMatch(/https?:\/\/|X-Amz-Signature|secretAccessKey|accessKeyId|stack/i);
  expect(serialized).not.toContain('signing failed');
  expect(serialized).not.toContain('storage unavailable');
}

describe('Product images HTTP with controlled storage', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let mailer: AuthMailer;
  let redis: RedisService;
  const fakeStorage = {
    createUploadUrl: jest.fn(),
    createReadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  } satisfies jest.Mocked<ProductImageStorage>;

  beforeAll(async () => {
    const ref = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRODUCT_IMAGE_STORAGE)
      .useValue(fakeStorage)
      .compile();
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
    mailer.send = AuthMailer.prototype.send.bind(mailer);
    mailer.sent.splice(0);
    await prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE');
    jest.resetAllMocks();
    fakeStorage.createUploadUrl.mockResolvedValue({
      uploadUrl: 'http://browser.invalid/upload',
      expiresAt: future(),
    });
    fakeStorage.createReadUrl.mockResolvedValue({
      readUrl: 'http://browser.invalid/read',
      expiresAt: future(),
    });
    fakeStorage.headObject.mockResolvedValue({ sizeBytes: 5, contentType: 'image/png' });
    fakeStorage.deleteObject.mockResolvedValue(undefined);
  });

  afterAll(() => app.close());

  async function activeSeller(label: string) {
    const email = `controlled-${crypto.randomUUID()}@example.test`;
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
    const token = mailer.sent.find(
      (item) => item.to === email && item.purpose === 'EMAIL_VERIFICATION',
    )?.token;
    await request(app.getHttpServer())
      .post('/api/v1/auth/email/verify')
      .send({ token })
      .expect(200);
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    await prisma.userRoleAssignment.create({ data: { userId: user.id, role: 'SELLER' } });
    const profile = await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        storeName: `Controlled ${label}`,
        slug: `controlled-${crypto.randomUUID()}`,
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
    const actor = await activeSeller(label);
    const category = await prisma.catalogCategory.create({
      data: { slug: `controlled-${crypto.randomUUID()}`, name: 'Controlled images' },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: actor.profile.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        status: 'APPROVED',
        title: 'Controlled product',
        description: 'Description',
      },
    });
    const item = await prisma.product.create({
      data: {
        listingTier: 'SILVER',
        sourceListingDraftId: draft.id,
        sellerProfileId: actor.profile.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        slug: `controlled-product-${crypto.randomUUID()}`,
        title: 'Controlled product',
        description: 'Description',
        status: 'UNPUBLISHED',
      },
    });
    return { ...actor, product: item };
  }

  const images = (id: string) => `/api/v1/seller/products/${id}/images`;
  async function intent(productId: string, auth: string) {
    return request(app.getHttpServer())
      .post(`${images(productId)}/upload-intents`)
      .set('Authorization', auth)
      .send({ contentType: 'image/png', sizeBytes: 5 })
      .expect(201);
  }

  it('rolls back a failed signing attempt without exposing the storage error', async () => {
    const actor = await product('signing');
    fakeStorage.createUploadUrl.mockRejectedValueOnce(new Error('signing failed'));
    const response = await request(app.getHttpServer())
      .post(`${images(actor.product.id)}/upload-intents`)
      .set('Authorization', actor.auth)
      .send({ contentType: 'image/png', sizeBytes: 5 });
    expect(response.status).toBe(500);
    expect(response.body.code).toBe('INTERNAL_SERVER_ERROR');
    expectSafeHttpPayload(response.body);
    expect(await prisma.productImage.count({ where: { productId: actor.product.id } })).toBe(0);
    expect(
      await prisma.securityEvent.count({
        where: { userId: actor.user.id, eventType: 'PRODUCT_IMAGE_UPLOAD_INTENT_CREATED' },
      }),
    ).toBe(0);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: actor.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });

  it('tombstones expired intents, cleans them up, and frees an occupied slot', async () => {
    const actor = await product('expiry');
    const created = await Promise.all(
      Array.from({ length: 8 }, () => intent(actor.product.id, actor.auth)),
    );
    const expired = await prisma.productImage.findUniqueOrThrow({
      where: { id: created[0].body.imageId },
    });
    await prisma.productImage.update({
      where: { id: expired.id },
      data: { uploadExpiresAt: new Date(Date.now() - 60_000) },
    });
    await intent(actor.product.id, actor.auth);
    const tombstone = await prisma.productImage.findUniqueOrThrow({ where: { id: expired.id } });
    expect(tombstone.status).toBe('DELETED');
    expect(tombstone.deletedAt).not.toBeNull();
    expect(fakeStorage.deleteObject).toHaveBeenCalledWith(expired.objectKey);
    expect(
      await prisma.productImage.count({
        where: { productId: actor.product.id, status: { in: ['PENDING_UPLOAD', 'READY'] } },
      }),
    ).toBe(8);
    const completion = await request(app.getHttpServer())
      .post(`${images(actor.product.id)}/${expired.id}/complete`)
      .set('Authorization', actor.auth);
    expect(completion.status).toBe(404);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: actor.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });

  it('rejects MIME metadata mismatch, audits it, and releases the slot', async () => {
    const actor = await product('mime');
    const created = await intent(actor.product.id, actor.auth);
    fakeStorage.headObject.mockResolvedValueOnce({ sizeBytes: 5, contentType: 'image/jpeg' });
    const response = await request(app.getHttpServer())
      .post(`${images(actor.product.id)}/${created.body.imageId}/complete`)
      .set('Authorization', actor.auth);
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('PRODUCT_IMAGE_UPLOAD_INVALID');
    const image = await prisma.productImage.findUniqueOrThrow({
      where: { id: created.body.imageId },
    });
    expect(image).toMatchObject({ status: 'DELETED', isCover: false });
    expect(image.deletedAt).not.toBeNull();
    expect(fakeStorage.deleteObject).toHaveBeenCalledWith(image.objectKey);
    expect(
      await prisma.securityEvent.count({
        where: {
          userId: actor.user.id,
          eventType: 'PRODUCT_IMAGE_UPLOAD_REJECTED',
          outcome: 'BLOCKED',
        },
      }),
    ).toBe(1);
    const audit = await prisma.securityEvent.findFirstOrThrow({
      where: { userId: actor.user.id, eventType: 'PRODUCT_IMAGE_UPLOAD_REJECTED' },
    });
    expectSafeAuditMetadata(audit.metadata);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: actor.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });

  it('retries cleanup through authenticated DELETE while retaining the tombstone', async () => {
    const actor = await product('cleanup');
    const created = await intent(actor.product.id, actor.auth);
    await request(app.getHttpServer())
      .post(`${images(actor.product.id)}/${created.body.imageId}/complete`)
      .set('Authorization', actor.auth)
      .expect(201);
    fakeStorage.deleteObject
      .mockRejectedValueOnce(new Error('storage unavailable'))
      .mockResolvedValue(undefined);
    const first = await request(app.getHttpServer())
      .delete(`${images(actor.product.id)}/${created.body.imageId}`)
      .set('Authorization', actor.auth);
    expect(first.status).toBe(503);
    expect(first.body.code).toBe('PRODUCT_IMAGE_CLEANUP_PENDING');
    expectSafeHttpPayload(first.body);
    const deleted = await prisma.productImage.findUniqueOrThrow({
      where: { id: created.body.imageId },
    });
    expect(deleted.status).toBe('DELETED');
    expect(deleted.deletedAt).not.toBeNull();
    const second = await request(app.getHttpServer())
      .delete(`${images(actor.product.id)}/${created.body.imageId}`)
      .set('Authorization', actor.auth)
      .expect(200);
    expect(second.body).toEqual({ deleted: true });
    expectSafeHttpPayload(second.body);
    await request(app.getHttpServer())
      .delete(`${images(actor.product.id)}/${created.body.imageId}`)
      .set('Authorization', actor.auth)
      .expect(200);
    expect(fakeStorage.deleteObject.mock.calls.length).toBeGreaterThanOrEqual(3);
    const listed = await request(app.getHttpServer())
      .get(images(actor.product.id))
      .set('Authorization', actor.auth)
      .expect(200);
    expect(listed.body.items).toEqual([]);
    expect(
      (await prisma.product.findUniqueOrThrow({ where: { id: actor.product.id } })).status,
    ).toBe('UNPUBLISHED');
  });
});
