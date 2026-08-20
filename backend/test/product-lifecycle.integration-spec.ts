import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import { ProductLifecycleAction } from '../src/products/dto';
import { ProductLifecycleService } from '../src/products/product-lifecycle.service';

describe('Product lifecycle with real PostgreSQL transactions', () => {
  let prisma: PrismaService;
  let service: ProductLifecycleService;
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    service = app.get(ProductLifecycleService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());

  async function fixture() {
    const suffix = crypto.randomUUID();
    const user = await prisma.user.create({
      data: {
        email: `lifecycle-${suffix}@example.test`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 'test',
        termsAcceptedAt: new Date(),
        privacyVersion: 'test',
        privacyAcceptedAt: new Date(),
      },
    });
    const seller = await prisma.sellerProfile.create({
      data: {
        userId: user.id,
        storeName: 'Lifecycle',
        slug: `lifecycle-${suffix}`,
        status: 'ACTIVE',
      },
    });
    const category = await prisma.catalogCategory.create({
      data: { name: 'Lifecycle', slug: `category-${suffix}`, status: 'ACTIVE' },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        status: 'APPROVED',
        title: 'Produto real',
        description: 'Descrição real',
        price: 10,
        stock: 0,
      },
    });
    const product = await prisma.product.create({
      data: {
        listingTier: 'SILVER',
        sourceListingDraftId: draft.id,
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'ACCOUNT',
        model: 'NORMAL',
        slug: `product-${suffix}`,
        title: 'Produto real',
        description: 'Descrição real',
        price: 10,
        stock: 0,
        variants: { create: { title: 'Padrão', price: 10, stock: 0, status: 'ACTIVE' } },
        images: {
          create: {
            objectKey: `private/${suffix}`,
            status: 'READY',
            contentType: 'image/png',
            sizeBytes: 1,
            sortOrder: 0,
            isCover: true,
            uploadedAt: new Date(),
            uploadExpiresAt: new Date(Date.now() + 60_000),
          },
        },
      },
    });
    return { user, seller, category, draft, product };
  }

  it.each(['categoryId', 'subcategoryId', 'productType'] as const)(
    'rolls back activation on %s source mismatch',
    async (field) => {
      const f = await fixture();
      if (field === 'categoryId') {
        const other = await prisma.catalogCategory.create({
          data: { name: 'Other', slug: `other-${crypto.randomUUID()}` },
        });
        await prisma.listingDraft.update({
          where: { id: f.draft.id },
          data: { categoryId: other.id },
        });
      } else if (field === 'subcategoryId') {
        const sub = await prisma.catalogSubcategory.create({
          data: { categoryId: f.category.id, name: 'Sub', slug: `sub-${crypto.randomUUID()}` },
        });
        await prisma.listingDraft.update({
          where: { id: f.draft.id },
          data: { subcategoryId: sub.id },
        });
      } else
        await prisma.listingDraft.update({
          where: { id: f.draft.id },
          data: { productType: 'GAME' },
        });
      await expect(
        service.transition(f.user.id, f.product.id, {
          action: ProductLifecycleAction.ACTIVATE,
          expectedVersion: 1,
        }),
      ).rejects.toMatchObject({ code: 'PRODUCT_TAXONOMY_MISMATCH' });
      expect(await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject(
        { status: 'UNPUBLISHED', version: 1 },
      );
      expect(await prisma.securityEvent.count({ where: { userId: f.user.id } })).toBe(0);
    },
  );

  it('serializes incompatible concurrent requests so exactly one commits', async () => {
    const f = await fixture();
    await service.transition(f.user.id, f.product.id, {
      action: ProductLifecycleAction.ACTIVATE,
      expectedVersion: 1,
    });
    const [pause, remove] = await Promise.allSettled([
      service.transition(f.user.id, f.product.id, {
        action: ProductLifecycleAction.PAUSE,
        expectedVersion: 2,
      }),
      service.transition(f.user.id, f.product.id, {
        action: ProductLifecycleAction.REMOVE,
        expectedVersion: 2,
      }),
    ]);
    expect([pause, remove].filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect([pause, remove].filter((result) => result.status === 'rejected')).toHaveLength(1);
    const persisted = await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } });
    expect(persisted.version).toBe(3);
    expect(['PAUSED', 'REMOVED']).toContain(persisted.status);
    expect(await prisma.securityEvent.count({ where: { userId: f.user.id } })).toBe(2);
  });

  it('rolls back product update when the audit insert fails', async () => {
    const f = await fixture();
    const trigger = `reject_lifecycle_${crypto.randomUUID().replaceAll('-', '')}`;
    const fn = `${trigger}_fn`;
    await prisma.$executeRawUnsafe(
      `CREATE FUNCTION "${fn}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW."eventType" = 'PRODUCT_ACTIVATED' THEN RAISE EXCEPTION 'audit rejected'; END IF; RETURN NEW; END $$`,
    );
    await prisma.$executeRawUnsafe(
      `CREATE TRIGGER "${trigger}" BEFORE INSERT ON "SecurityEvent" FOR EACH ROW EXECUTE FUNCTION "${fn}"()`,
    );
    try {
      await expect(
        service.transition(f.user.id, f.product.id, {
          action: ProductLifecycleAction.ACTIVATE,
          expectedVersion: 1,
        }),
      ).rejects.toThrow();
      expect(await prisma.product.findUniqueOrThrow({ where: { id: f.product.id } })).toMatchObject(
        { status: 'UNPUBLISHED', version: 1 },
      );
    } finally {
      await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${trigger}" ON "SecurityEvent"`);
      await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${fn}"()`);
    }
  });
});
