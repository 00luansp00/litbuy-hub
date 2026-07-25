import { randomUUID } from 'node:crypto';
import { AppError } from '../common/errors/app-error';

export const PRODUCT_IMAGE_LIMIT = 8;
export const PRODUCT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PRODUCT_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

export function extensionFor(contentType: string): string {
  const extensions: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  };
  const extension = extensions[contentType];
  if (!extension)
    throw new AppError('PRODUCT_IMAGE_TYPE_INVALID', 'PRODUCT_IMAGE_TYPE_INVALID', 400, []);
  return extension;
}

export function validateImage(contentType: string, sizeBytes: number): void {
  extensionFor(contentType);
  if (!Number.isInteger(sizeBytes) || sizeBytes <= 0 || sizeBytes > PRODUCT_IMAGE_MAX_BYTES)
    throw new AppError('PRODUCT_IMAGE_SIZE_INVALID', 'PRODUCT_IMAGE_SIZE_INVALID', 400, []);
}

export function createImageIdentity(productId: string) {
  const imageId = randomUUID();
  return { imageId, objectKey: `products/${productId}/${imageId}/original` };
}

export function objectKeyFor(productId: string, imageId: string, contentType: string) {
  return `products/${productId}/${imageId}/original.${extensionFor(contentType)}`;
}

export function nextCover<T extends { id: string; sortOrder: number }>(images: T[]): T | undefined {
  return [...images].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))[0];
}
