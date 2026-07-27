import { ConfigService } from '@nestjs/config';
import { S3ProductImageStorage } from './s3-product-image.storage';
describe('S3ProductImageStorage endpoint separation', () => {
  const base = {
    PRODUCT_IMAGE_S3_ENDPOINT: 'http://minio:9000',
    PRODUCT_IMAGE_S3_SIGNING_ENDPOINT: 'http://localhost:19000',
    PRODUCT_IMAGE_S3_REGION: 'us-east-1',
    PRODUCT_IMAGE_S3_BUCKET: 'images',
    PRODUCT_IMAGE_S3_ACCESS_KEY: 'access',
    PRODUCT_IMAGE_S3_SECRET_KEY: 'secret',
    PRODUCT_IMAGE_S3_FORCE_PATH_STYLE: 'true',
    PRODUCT_IMAGE_UPLOAD_URL_TTL_SECONDS: '120',
    PRODUCT_IMAGE_READ_URL_TTL_SECONDS: '120',
  };
  it('signs PUT and GET for the browser endpoint rather than the internal hostname', async () => {
    const storage = new S3ProductImageStorage(new ConfigService(base));
    const upload = await storage.createUploadUrl({
      key: 'products/id/image.png',
      contentType: 'image/png',
    });
    const read = await storage.createReadUrl('products/id/image.png');
    expect(new URL(upload.uploadUrl).host).toBe('localhost:19000');
    expect(new URL(read.readUrl).host).toBe('localhost:19000');
    expect(upload.uploadUrl).not.toContain('minio:9000');
  });
  it('falls back to the internal endpoint when no signing endpoint is configured', async () => {
    const fallback = { ...base, PRODUCT_IMAGE_S3_SIGNING_ENDPOINT: undefined };
    const storage = new S3ProductImageStorage(new ConfigService(fallback));
    expect(new URL((await storage.createReadUrl('image.png')).readUrl).host).toBe('minio:9000');
  });
});
