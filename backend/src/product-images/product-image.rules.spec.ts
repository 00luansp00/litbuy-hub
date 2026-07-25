import { AppError } from '../common/errors/app-error';
import {
  PRODUCT_IMAGE_LIMIT,
  PRODUCT_IMAGE_MAX_BYTES,
  extensionFor,
  nextCover,
  objectKeyFor,
  validateImage,
} from './product-image.rules';
describe('product image rules', () => {
  it.each([
    ['image/jpeg', 'jpg'],
    ['image/png', 'png'],
    ['image/webp', 'webp'],
  ])('maps %s', (mime, ext) => expect(extensionFor(mime)).toBe(ext));
  it.each(['image/svg+xml', 'image/gif', 'application/octet-stream'])('rejects %s', (mime) =>
    expect(() => validateImage(mime, 1)).toThrow(AppError),
  );
  it('enforces positive five MiB limit', () => {
    expect(() => validateImage('image/png', 0)).toThrow();
    expect(() => validateImage('image/png', PRODUCT_IMAGE_MAX_BYTES + 1)).toThrow();
    expect(() => validateImage('image/png', PRODUCT_IMAGE_MAX_BYTES)).not.toThrow();
  });
  it('generates backend-owned keys', () =>
    expect(objectKeyFor('product', 'image', 'image/webp')).toBe(
      'products/product/image/original.webp',
    ));
  it('declares an eight image limit', () => expect(PRODUCT_IMAGE_LIMIT).toBe(8));
  it('promotes deterministically', () =>
    expect(
      nextCover([
        { id: 'b', sortOrder: 1 },
        { id: 'c', sortOrder: 0 },
        { id: 'a', sortOrder: 0 },
      ])?.id,
    ).toBe('a'));
});
