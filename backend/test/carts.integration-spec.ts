import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

describe('Cart database constraints with real PostgreSQL', () => {
  let prisma: PrismaService;
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  beforeAll(async () => {
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
  });
  beforeEach(() => prisma.$executeRawUnsafe('TRUNCATE TABLE "User", "CatalogCategory" CASCADE'));
  afterAll(() => app.close());
  async function fixture() {
    const suffix = crypto.randomUUID();
    const buyer = await prisma.user.create({
      data: {
        email: `buyer-${suffix}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const sellerUser = await prisma.user.create({
      data: {
        email: `seller-${suffix}@test.local`,
        birthDate: new Date('2000-01-01'),
        status: 'ACTIVE',
        termsVersion: 't',
        termsAcceptedAt: new Date(),
        privacyVersion: 'p',
        privacyAcceptedAt: new Date(),
      },
    });
    const seller = await prisma.sellerProfile.create({
      data: { userId: sellerUser.id, storeName: 'Store', slug: `store-${suffix}` },
    });
    const category = await prisma.catalogCategory.create({
      data: { name: 'Cat', slug: `cat-${suffix}` },
    });
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'GAME',
        model: 'DYNAMIC',
        status: 'APPROVED',
      },
    });
    const product = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: seller.id,
        categoryId: category.id,
        productType: 'GAME',
        model: 'DYNAMIC',
        slug: `product-${suffix}`,
        title: 'Product',
        description: 'Description',
        variants: { create: { title: 'One', price: 10, stock: 10 } },
      },
      include: { variants: true },
    });
    const cart = await prisma.cart.create({
      data: { buyerUserId: buyer.id, sellerProfileId: seller.id },
    });
    return { buyer, seller, product, variant: product.variants[0], cart };
  }
  it('rejects a second ACTIVE cart for one buyer and seller', async () => {
    const f = await fixture();
    await expect(
      prisma.cart.create({ data: { buyerUserId: f.buyer.id, sellerProfileId: f.seller.id } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects duplicate lines without a variant', async () => {
    const f = await fixture();
    await prisma.cartItem.create({
      data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 },
    });
    await expect(
      prisma.cartItem.create({ data: { cartId: f.cart.id, productId: f.product.id, quantity: 1 } }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it('rejects duplicate lines with the same variant', async () => {
    const f = await fixture();
    await prisma.cartItem.create({
      data: {
        cartId: f.cart.id,
        productId: f.product.id,
        productVariantId: f.variant.id,
        quantity: 1,
      },
    });
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: f.cart.id,
          productId: f.product.id,
          productVariantId: f.variant.id,
          quantity: 1,
        },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });
  it.each([0, 1000])('rejects quantity %s', async (quantity) => {
    const f = await fixture();
    await expect(
      prisma.cartItem.create({ data: { cartId: f.cart.id, productId: f.product.id, quantity } }),
    ).rejects.toBeDefined();
  });
  it('rejects version zero', async () => {
    const f = await fixture();
    await expect(
      prisma.cart.update({ where: { id: f.cart.id }, data: { version: 0 } }),
    ).rejects.toBeDefined();
  });
  it('rejects a variant belonging to another product', async () => {
    const f = await fixture();
    const draft = await prisma.listingDraft.create({
      data: {
        sellerProfileId: f.seller.id,
        categoryId: f.product.categoryId,
        productType: 'GAME',
        model: 'DYNAMIC',
        status: 'APPROVED',
      },
    });
    const other = await prisma.product.create({
      data: {
        sourceListingDraftId: draft.id,
        sellerProfileId: f.seller.id,
        categoryId: f.product.categoryId,
        productType: 'GAME',
        model: 'DYNAMIC',
        slug: `other-${crypto.randomUUID()}`,
        title: 'Other',
        description: 'Other',
        variants: { create: { title: 'Other', price: 10, stock: 10 } },
      },
      include: { variants: true },
    });
    await expect(
      prisma.cartItem.create({
        data: {
          cartId: f.cart.id,
          productId: f.product.id,
          productVariantId: other.variants[0].id,
          quantity: 1,
        },
      }),
    ).rejects.toBeDefined();
  });
});
