import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  PublicCatalogQueryDto,
  PublicCatalogSort,
  PublicProductSlugDto,
} from './public-product-catalog.dto';

describe('public catalog DTOs', () => {
  it('applies defaults and explicitly converts numeric pagination', async () => {
    const defaults = plainToInstance(PublicCatalogQueryDto, {});
    expect(defaults).toMatchObject({ page: 1, limit: 24, sort: PublicCatalogSort.RECENT });
    const query = plainToInstance(PublicCatalogQueryDto, { page: '2', limit: '50' });
    expect(query).toMatchObject({ page: 2, limit: 50 });
    expect(await validate(query)).toHaveLength(0);
  });

  it.each([
    { page: 0 },
    { page: 101 },
    { limit: 0 },
    { limit: 51 },
    { page: 1.5 },
    { sort: 'POPULAR' },
    { productType: 'FAKE' },
    { categorySlug: 'Not a slug' },
    { subcategorySlug: '-invalid' },
  ])('rejects invalid query %#', async (value) => {
    expect(await validate(plainToInstance(PublicCatalogQueryDto, value))).not.toHaveLength(0);
  });

  it('validates a detail slug', async () => {
    expect(
      await validate(plainToInstance(PublicProductSlugDto, { slug: 'valid-slug' })),
    ).toHaveLength(0);
    expect(
      await validate(plainToInstance(PublicProductSlugDto, { slug: 'INVALID' })),
    ).not.toHaveLength(0);
  });
});
