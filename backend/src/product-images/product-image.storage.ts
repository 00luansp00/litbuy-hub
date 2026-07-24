export const PRODUCT_IMAGE_STORAGE = Symbol('PRODUCT_IMAGE_STORAGE');
export interface StoredObjectMetadata {
  sizeBytes: number;
  contentType?: string;
}
export interface ProductImageStorage {
  createUploadUrl(input: {
    key: string;
    contentType: string;
  }): Promise<{ uploadUrl: string; expiresAt: Date }>;
  headObject(key: string): Promise<StoredObjectMetadata | null>;
  deleteObject(key: string): Promise<void>;
}
