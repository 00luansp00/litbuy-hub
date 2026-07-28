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
import { createCatalogFixture, truncateCatalog } from './public-catalog-test.helpers';

describe('Public product catalog with real PostgreSQL and MinIO', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let storage: ProductImageStorage;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.enableVersioning({ type: VersioningType.URI });
    app.useGlobalPipes(
      new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }),
    );
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
    prisma = app.get(PrismaService);
    storage = app.get<ProductImageStorage>(PRODUCT_IMAGE_STORAGE);
  });
  beforeEach(() => truncateCatalog(prisma));
  afterAll(() => app.close());

  it('serves a private real object through the configured signed public URL only while eligible', async () => {
    const fixture = await createCatalogFixture(prisma, { slug: 'real-minio-product' });
    const key = fixture.images[0].objectKey;
    const upload = await storage.createUploadUrl({ key, contentType: 'image/png' });
    const content = Buffer.from('real-public-catalog-image');
    const put = await fetch(upload.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'image/png', 'If-None-Match': '*' },
      body: content,
    });
    expect(put.ok).toBe(true);
    try {
      const response = await request(app.getHttpServer())
        .get('/api/v1/catalog/products/real-minio-product')
        .expect(200);
      const signedUrl = response.body.coverImage.url as string;
      const expectedOrigin = new URL(process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT!).origin;
      expect(new URL(signedUrl).origin).toBe(expectedOrigin);
      expect(signedUrl).not.toContain('minio:9000');
      expect(signedUrl).toMatch(/X-Amz-Expires=/);
      expect(response.body.coverImage.expiresAt).toBeTruthy();
      expect(JSON.stringify(response.body)).not.toContain('objectKey');
      const download = await fetch(signedUrl);
      expect(download.ok).toBe(true);
      expect(Buffer.from(await download.arrayBuffer())).toEqual(content);

      await prisma.sellerProfile.update({
        where: { id: fixture.seller.id },
        data: { status: 'SUSPENDED' },
      });
      const hidden = await request(app.getHttpServer()).get('/api/v1/catalog/products').expect(200);
      expect(hidden.body.items).toEqual([]);
      await request(app.getHttpServer())
        .get('/api/v1/catalog/products/real-minio-product')
        .expect(404);
    } finally {
      await storage.deleteObject(key);
    }
  });
});
