import 'reflect-metadata';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { GlobalExceptionFilter } from '../src/common/filters/global-exception.filter';
import { PrismaService } from '../src/database/prisma.service';
import {
  PRODUCT_IMAGE_STORAGE,
  type ProductImageStorage,
} from '../src/product-images/product-image.storage';
import {
  addImage,
  addVariant,
  createCatalogFixture,
  truncateCatalog,
  type CatalogFixtureOptions,
} from './public-catalog-test.helpers';

const expiresAt = new Date('2030-01-01T00:00:00.000Z');
type ListBody = {
  items: Array<{ id: string; slug: string }>;
  pagination: { page: number; limit: number; hasNext: boolean };
};
type DetailBody = {
  id: string;
  code?: string;
  variants: Array<{ title: string }>;
  gallery: Array<{ id: string; url: string }>;
  coverImage: { url: string };
};
const forbidden = [
  'objectKey',
  'sourceListingDraftId',
  'sellerProfileId',
  'categoryId',
  'subcategoryId',
  'userId',
  'email',
  'phone',
  'version',
  'autoMessage',
  'buyerRequirements',
  'notes',
  'accountDetails',
  'rejectionCode',
  'rejectionReason',
  'accessToken',
  'refreshToken',
  'csrf',
  'password',
  'hash',
  'stack',
  'minio:9000',
];
function expectPublicPayload(payload: unknown) {
  const serialized = JSON.stringify(payload);
  for (const field of forbidden)
    expect(serialized.toLowerCase()).not.toContain(field.toLowerCase());
}

describe('Public product catalog HTTP with PostgreSQL and controlled storage', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const storage = {
    createUploadUrl: jest.fn(),
    createReadUrl: jest.fn(),
    headObject: jest.fn(),
    deleteObject: jest.fn(),
  } satisfies jest.Mocked<ProductImageStorage>;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PRODUCT_IMAGE_STORAGE)
      .useValue(storage)
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await truncateCatalog(prisma);
    jest.resetAllMocks();
    storage.createReadUrl.mockImplementation((key) =>
      Promise.resolve({
        readUrl: `https://public-images.example.test/signed/${encodeURIComponent(key)}`,
        expiresAt,
      }),
    );
  });
  afterAll(() => app.close());

  it('serves list and detail without token, cookie, or CSRF and applies HTTP defaults', async () => {
    const fixture = await createCatalogFixture(prisma, { slug: 'public-product' });
    const list = await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(200);
    const listBody = list.body as ListBody;
    expect(listBody.pagination).toEqual({ page: 1, limit: 24, hasNext: false });
    expect(listBody.items).toHaveLength(1);
    const detail = await request(app.getHttpServer())
      .get('/api/v1/catalog/products/public-product')
      .expect(200);
    expect((detail.body as DetailBody).id).toBe(fixture.product.id);
    expectPublicPayload(list.body);
    expectPublicPayload(detail.body);
    expect(await prisma.securityEvent.count()).toBe(0);
  });

  it.each<[string, CatalogFixtureOptions]>([
    ['UNPUBLISHED product', { productStatus: 'UNPUBLISHED' }],
    ['PAUSED product', { productStatus: 'PAUSED' }],
    ['REMOVED product', { productStatus: 'REMOVED' }],
    ['SUSPENDED seller', { sellerStatus: 'SUSPENDED' }],
    ['CLOSED seller', { sellerStatus: 'CLOSED' }],
    ['unapproved draft', { draftStatus: 'REJECTED' }],
    ['category mismatch', { categoryMismatch: true }],
    ['subcategory mismatch', { subcategoryMismatch: true }],
    ['product type mismatch', { draftProductType: 'GAME' }],
    ['inactive category', { categoryStatus: 'INACTIVE' }],
    ['inactive subcategory', { subcategoryStatus: 'INACTIVE' }],
    ['incompatible subcategory', { incompatibleSubcategory: true }],
    ['missing READY cover', { coverCount: 0 }],
    ['invalid variant', { invalidVariant: true }],
    [
      'invalid service',
      {
        model: 'SERVICE',
        productType: 'SERVICE',
        servicePricingType: 'FIXED',
        invalidService: true,
      },
    ],
  ])('hides %s without signing', async (_label, options) => {
    const fixture = await createCatalogFixture(prisma, options);
    const list = await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(200);
    expect((list.body as ListBody).items).toEqual([]);
    const detail = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/${fixture.product.slug}`)
      .expect(404);
    expect((detail.body as { code: string }).code).toBe('PRODUCT_NOT_FOUND');
    expect(storage.createReadUrl).not.toHaveBeenCalled();
  });

  it('returns the identical public error for missing and invisible slugs', async () => {
    const hidden = await createCatalogFixture(prisma, { productStatus: 'PAUSED' });
    const missing = await request(app.getHttpServer())
      .get('/api/v1/catalog/products/not-present')
      .expect(404);
    const invisible = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/${hidden.product.slug}`)
      .expect(404);
    const missingBody = missing.body as { code: string };
    const invisibleBody = invisible.body as { code: string };
    expect({ status: missing.status, code: missingBody.code }).toEqual({
      status: invisible.status,
      code: invisibleBody.code,
    });
    expect(missingBody.code).toBe('PRODUCT_NOT_FOUND');
  });

  it('applies category, subcategory, type, and compatible combined filters', async () => {
    const match = await createCatalogFixture(prisma, { productType: 'ACCOUNT' });
    await createCatalogFixture(prisma, { productType: 'GAME' });
    for (const query of [
      `categorySlug=${match.category.slug}`,
      `subcategorySlug=${match.subcategory!.slug}`,
      'productType=ACCOUNT',
      `categorySlug=${match.category.slug}&subcategorySlug=${match.subcategory!.slug}`,
    ]) {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products?${query}`)
        .expect(200);
      expect((response.body as ListBody).items.map((item) => item.id)).toEqual([match.product.id]);
    }
    const incompatible = await request(app.getHttpServer())
      .get(
        `/api/v1/catalog/products?categorySlug=${match.otherCategory.slug}&subcategorySlug=${match.subcategory!.slug}`,
      )
      .expect(200);
    expect((incompatible.body as ListBody).items).toEqual([]);
  });

  it.each(['unknown=true', 'page=0', 'page=101', 'limit=0', 'limit=51', 'sort=POPULAR'])(
    'rejects invalid query %s',
    async (query) => {
      await request(app.getHttpServer()).get(`/api/v1/catalog/products?${query}`).expect(400);
    },
  );

  it('rejects an invalid detail slug', async () => {
    await request(app.getHttpServer()).get('/api/v1/catalog/products/INVALID_slug').expect(400);
  });

  it.each([
    ['RECENT', ['recent-b', 'recent-a']],
    ['OLDEST', ['recent-a', 'recent-b']],
    ['TITLE_ASC', ['recent-a', 'recent-b']],
    ['TITLE_DESC', ['recent-b', 'recent-a']],
  ])('implements %s ordering with deterministic id tie-breaks', async (sort, expected) => {
    const date = new Date('2026-01-01T00:00:00.000Z');
    await createCatalogFixture(prisma, {
      productId: '00000000-0000-4000-8000-000000000001',
      slug: 'recent-a',
      title: 'Same title',
      updatedAt: date,
    });
    await createCatalogFixture(prisma, {
      productId: '00000000-0000-4000-8000-000000000002',
      slug: 'recent-b',
      title: 'Same title',
      updatedAt: date,
    });
    const response = await request(app.getHttpServer())
      .get(`/api/v1/catalog/products?sort=${sort}`)
      .expect(200);
    expect((response.body as ListBody).items.map((item) => item.slug)).toEqual(expected);
  });

  it('paginates after eligibility, has no duplicates/loss, and signs only the requested page', async () => {
    const visible = [];
    for (let index = 0; index < 5; index += 1) {
      visible.push(
        await createCatalogFixture(prisma, {
          slug: `visible-${index}`,
          title: `Visible ${index}`,
          updatedAt: new Date(Date.UTC(2026, 0, 10 - index)),
        }),
      );
      await createCatalogFixture(prisma, {
        slug: `hidden-${index}`,
        title: `Hidden ${index}`,
        updatedAt: new Date(Date.UTC(2026, 0, 10 - index, 12)),
        categoryMismatch: true,
      });
    }
    const pages: ListBody[] = [];
    for (let page = 1; page <= 3; page += 1) {
      storage.createReadUrl.mockClear();
      const response = await request(app.getHttpServer())
        .get(`/api/v1/catalog/products?page=${page}&limit=2`)
        .expect(200);
      const body = response.body as ListBody;
      pages.push(body);
      expect(storage.createReadUrl).toHaveBeenCalledTimes(body.items.length);
      const signedCalls = storage.createReadUrl.mock.calls as unknown as Array<[string]>;
      expect(signedCalls.map(([key]) => key)).toEqual(
        body.items.map((item) => `catalog/${item.id}/cover-0.png`),
      );
    }
    const ids = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(visible.map((item) => item.product.id)));
    expect(pages.map((page) => page.pagination.hasNext)).toEqual([true, true, false]);
  });

  it('returns ordered ACTIVE variants and ordered READY gallery, signing no pending/deleted image', async () => {
    const fixture = await createCatalogFixture(prisma, {
      slug: 'dynamic-detail',
      model: 'DYNAMIC',
    });
    await prisma.productVariant.updateMany({
      where: { productId: fixture.product.id },
      data: { title: 'Active later', sortOrder: 20 },
    });
    await addVariant(prisma, fixture.product.id, {
      title: 'Paused first',
      status: 'PAUSED',
      sortOrder: 0,
    });
    await addVariant(prisma, fixture.product.id, {
      title: 'Active first',
      status: 'ACTIVE',
      sortOrder: 5,
    });
    const ready = await addImage(prisma, fixture.product.id, { status: 'READY', sortOrder: 5 });
    await addImage(prisma, fixture.product.id, { status: 'PENDING_UPLOAD', sortOrder: 1 });
    await addImage(prisma, fixture.product.id, { status: 'DELETED', sortOrder: 2 });
    const response = await request(app.getHttpServer())
      .get('/api/v1/catalog/products/dynamic-detail')
      .expect(200);
    const body = response.body as DetailBody;
    expect(body.variants.map((variant) => variant.title)).toEqual(['Active first', 'Active later']);
    expect(body.gallery.map((image) => image.id)).toEqual([fixture.images[0].id, ready.id]);
    expect(body.coverImage.url).toBe(body.gallery[0].url);
    const signedCalls = storage.createReadUrl.mock.calls as unknown as Array<[string]>;
    expect(signedCalls.map(([key]) => key)).toEqual([fixture.images[0].objectKey, ready.objectKey]);
    expectPublicPayload(response.body);
  });

  it('does not leak an internal signing failure', async () => {
    const fixture = await createCatalogFixture(prisma);
    storage.createReadUrl.mockRejectedValueOnce(
      new Error(`credentials secret at http://minio:9000/${fixture.images[0].objectKey}`),
    );
    const response = await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(500);
    expect((response.body as { code: string }).code).toBe('INTERNAL_SERVER_ERROR');
    expectPublicPayload(response.body);
  });

  it('repeated GET requests never create SecurityEvent rows', async () => {
    const fixture = await createCatalogFixture(prisma);
    await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(200);
    await request(app.getHttpServer())
      .get(`/api/v1/catalog/products/${fixture.product.slug}`)
      .expect(200);
    await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(200);
    expect(await prisma.securityEvent.count()).toBe(0);
  });
});
