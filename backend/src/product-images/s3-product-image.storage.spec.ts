import type { ConfigService } from '@nestjs/config';
import { S3ProductImageStorage } from './s3-product-image.storage';

function createConfig(values: Record<string, string | undefined>): ConfigService {
  return {
    get: <T>(key: string, defaultValue?: T): T | undefined => {
      const value = values[key];
      return value === undefined ? defaultValue : (value as T);
    },
    getOrThrow: <T>(key: string): T => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing config: ${key}`);
      return value as T;
    },
  } as unknown as ConfigService;
}

describe('S3ProductImageStorage endpoint separation', () => {
  const originalSigningEndpoint = process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT;
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
  afterEach(() => {
    if (originalSigningEndpoint === undefined) delete process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT;
    else process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT = originalSigningEndpoint;
  });
  it('signs PUT and GET for the browser endpoint rather than the internal hostname', async () => {
    const storage = new S3ProductImageStorage(createConfig(base));
    const upload = await storage.createUploadUrl({
      key: 'products/id/image.png',
      contentType: 'image/png',
    });
    const read = await storage.createReadUrl('products/id/image.png');
    expect(new URL(upload.uploadUrl).host).toBe('localhost:19000');
    expect(new URL(read.readUrl).host).toBe('localhost:19000');
    expect(upload.uploadUrl).not.toContain('minio:9000');
  });
  it('falls back to the internal endpoint independently of process.env', async () => {
    process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT = 'http://environment.invalid:9999';
    const storage = new S3ProductImageStorage(
      createConfig({ ...base, PRODUCT_IMAGE_S3_SIGNING_ENDPOINT: undefined }),
    );
    const readUrl = (await storage.createReadUrl('image.png')).readUrl;
    expect(new URL(readUrl).host).toBe('minio:9000');
    expect(readUrl).not.toContain('environment.invalid');
  });
  it('uses supplied values even when process.env contains a conflicting endpoint', async () => {
    process.env.PRODUCT_IMAGE_S3_SIGNING_ENDPOINT = 'http://environment.invalid:9999';
    const storage = new S3ProductImageStorage(createConfig(base));
    expect(new URL((await storage.createReadUrl('image.png')).readUrl).host).toBe(
      'localhost:19000',
    );
  });
});
