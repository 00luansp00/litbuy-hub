import 'reflect-metadata';
import { PrismaClient } from '@prisma/client';
import type { PrismaService } from '../src/database/prisma.service';
import type { ProductImageStorage } from '../src/product-images/product-image.storage';
import { PublicCatalogSort } from '../src/products/public-product-catalog.dto';
import { PublicProductCatalogService } from '../src/products/public-product-catalog.service';
import { createCatalogFixture, truncateCatalog } from './public-catalog-test.helpers';

describe('Public product catalog pagination with real PostgreSQL', () => {
  const client = new PrismaClient();
  const prisma = client as PrismaService;
  const storage: ProductImageStorage = {
    createUploadUrl: () => Promise.resolve({ uploadUrl: '', expiresAt: new Date() }),
    createReadUrl: (key) =>
      Promise.resolve({
        readUrl: `https://images.example.test/${encodeURIComponent(key)}`,
        expiresAt: new Date('2030-01-01T00:00:00.000Z'),
      }),
    headObject: () => Promise.resolve(null),
    deleteObject: () => Promise.resolve(),
  };
  const service = new PublicProductCatalogService(prisma, storage);
  beforeAll(() => client.$connect());
  beforeEach(() => truncateCatalog(prisma));
  afterAll(() => client.$disconnect());

  it('keeps three real pages stable while interleaved ineligible rows do not consume offsets', async () => {
    const eligible = [];
    const sameDate = new Date('2026-02-01T00:00:00.000Z');
    for (let index = 1; index <= 7; index += 1) {
      const visibleOrdinal = index * 2 - 1;
      const hiddenOrdinal = index * 2;
      eligible.push(
        await createCatalogFixture(prisma, {
          productId: `00000000-0000-4000-8000-${visibleOrdinal.toString().padStart(12, '0')}`,
          slug: `eligible-${index}`,
          title: 'Repeated title',
          updatedAt: sameDate,
        }),
      );
      await createCatalogFixture(prisma, {
        productId: `00000000-0000-4000-8000-${hiddenOrdinal.toString().padStart(12, '0')}`,
        slug: `ineligible-${index}`,
        title: 'Repeated title',
        updatedAt: sameDate,
        coverCount: 2,
      });
    }
    const pages = await Promise.all(
      [1, 2, 3].map((page) => service.list({ page, limit: 3, sort: PublicCatalogSort.TITLE_ASC })),
    );
    const ids = pages.flatMap((page) => page.items.map((item) => item.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(ids)).toEqual(new Set(eligible.map((fixture) => fixture.product.id)));
    expect(pages.map((page) => page.items.length)).toEqual([3, 3, 1]);
    expect(pages.map((page) => page.pagination.hasNext)).toEqual([true, true, false]);
    expect(ids).toEqual([...ids].sort());
  });

  it('re-evaluates persisted seller, draft, taxonomy, variant, and image changes', async () => {
    const fixture = await createCatalogFixture(prisma);
    const visible = async () =>
      (await service.list({ page: 1, limit: 24, sort: PublicCatalogSort.RECENT })).items.length;
    expect(await visible()).toBe(1);
    await prisma.sellerProfile.update({
      where: { id: fixture.seller.id },
      data: { status: 'CLOSED' },
    });
    expect(await visible()).toBe(0);
    await prisma.sellerProfile.update({
      where: { id: fixture.seller.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.listingDraft.update({
      where: { id: fixture.draft.id },
      data: { status: 'REJECTED' },
    });
    expect(await visible()).toBe(0);
    await prisma.listingDraft.update({
      where: { id: fixture.draft.id },
      data: { status: 'APPROVED' },
    });
    await prisma.catalogCategory.update({
      where: { id: fixture.category.id },
      data: { status: 'INACTIVE' },
    });
    expect(await visible()).toBe(0);
    await prisma.catalogCategory.update({
      where: { id: fixture.category.id },
      data: { status: 'ACTIVE' },
    });
    await prisma.productVariant.updateMany({
      where: { productId: fixture.product.id },
      data: { price: null },
    });
    expect(await visible()).toBe(0);
    await prisma.productVariant.updateMany({
      where: { productId: fixture.product.id },
      data: { price: 19.9 },
    });
    await prisma.productImage.update({
      where: { id: fixture.images[0].id },
      data: { status: 'DELETED' },
    });
    expect(await visible()).toBe(0);
  });
});
