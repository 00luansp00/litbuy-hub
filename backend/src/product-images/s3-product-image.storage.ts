import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  S3Client,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ProductImageStorage, StoredObjectMetadata } from './product-image.storage';

@Injectable()
export class S3ProductImageStorage implements ProductImageStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly expires: number;
  private readonly readExpires: number;
  constructor(config: ConfigService) {
    this.bucket = config.get('PRODUCT_IMAGE_S3_BUCKET', 'litbuy-product-images');
    this.expires = Number(config.get('PRODUCT_IMAGE_UPLOAD_URL_TTL_SECONDS', '300'));
    this.readExpires = Number(config.get('PRODUCT_IMAGE_READ_URL_TTL_SECONDS', '120'));
    this.client = new S3Client({
      endpoint: config.get('PRODUCT_IMAGE_S3_ENDPOINT'),
      region: config.get('PRODUCT_IMAGE_S3_REGION', 'us-east-1'),
      forcePathStyle: config.get('PRODUCT_IMAGE_S3_FORCE_PATH_STYLE', 'true') === 'true',
      credentials: {
        accessKeyId: config.getOrThrow('PRODUCT_IMAGE_S3_ACCESS_KEY'),
        secretAccessKey: config.getOrThrow('PRODUCT_IMAGE_S3_SECRET_KEY'),
      },
    });
  }
  async createReadUrl(key: string) {
    const readUrl = await getSignedUrl(
      this.client,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      { expiresIn: this.readExpires },
    );
    return { readUrl, expiresAt: new Date(Date.now() + this.readExpires * 1000) };
  }
  async createUploadUrl(input: { key: string; contentType: string }) {
    const uploadUrl = await getSignedUrl(
      this.client,
      new PutObjectCommand({ Bucket: this.bucket, Key: input.key, ContentType: input.contentType }),
      { expiresIn: this.expires },
    );
    return { uploadUrl, expiresAt: new Date(Date.now() + this.expires * 1000) };
  }
  async headObject(key: string): Promise<StoredObjectMetadata | null> {
    try {
      const result = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
    } catch (error) {
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode === 404)
        return null;
      throw error;
    }
  }
  async deleteObject(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}
