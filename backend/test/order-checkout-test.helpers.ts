import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthMailer } from '../src/auth/auth.service';
import type { PrismaService } from '../src/database/prisma.service';

export async function createActor(
  app: INestApplication,
  prisma: PrismaService,
  mailer: AuthMailer,
) {
  const email = `checkout-${crypto.randomUUID()}@example.test`;
  const password = 'checkout integration password 123';
  const registration = await request(app.getHttpServer()).post('/api/v1/auth/register').send({
    email,
    password,
    birthDate: '2000-01-01',
    termsAccepted: true,
    privacyAccepted: true,
    termsVersion: process.env.CURRENT_TERMS_VERSION,
    privacyVersion: process.env.CURRENT_PRIVACY_VERSION,
  });
  const token = mailer.sent.find(
    (item) => item.to === email && item.purpose === 'EMAIL_VERIFICATION',
  )?.token;
  await request(app.getHttpServer()).post('/api/v1/auth/email/verify').send({ token }).expect(200);
  const login = await request(app.getHttpServer())
    .post('/api/v1/auth/login')
    .set('Cookie', registration.headers['set-cookie'] as unknown as string[])
    .send({ email, password })
    .expect(200);
  const cookies = login.headers['set-cookie'] as unknown as string[];
  const csrfCookie = cookies
    .map((cookie) => cookie.split(';')[0])
    .find((cookie) => cookie.startsWith('litbuy_csrf='));
  if (!csrfCookie) throw new Error('missing csrf cookie');
  return {
    user: await prisma.user.findUniqueOrThrow({ where: { email } }),
    authorization: `Bearer ${String(login.body.accessToken)}`,
    cookies,
    csrf: csrfCookie.split('=')[1],
  };
}

export const authHeaders = (actor: Awaited<ReturnType<typeof createActor>>, csrf = true) => ({
  Authorization: actor.authorization,
  Cookie: actor.cookies,
  ...(csrf ? { 'X-CSRF-Token': actor.csrf } : {}),
});

export async function commerceFixture(
  prisma: PrismaService,
  model: 'NORMAL' | 'DYNAMIC' | 'SERVICE' = 'NORMAL',
  pricingType?: 'FIXED' | 'QUOTE',
  stock = 5,
) {
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
      roleAssignments: { create: { role: 'BUYER' } },
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
    data: { userId: sellerUser.id, storeName: 'Snapshot Store', slug: `store-${suffix}` },
  });
  const category = await prisma.catalogCategory.create({
    data: { name: 'Games', slug: `games-${suffix}` },
  });
  const draft = await prisma.listingDraft.create({
    data: {
      sellerProfileId: seller.id,
      categoryId: category.id,
      productType: model === 'SERVICE' ? 'SERVICE' : 'GAME',
      model,
      status: 'APPROVED',
    },
  });
  const fixed = model === 'SERVICE' && pricingType === 'FIXED';
  const product = await prisma.product.create({
    data: {
      sourceListingDraftId: draft.id,
      sellerProfileId: seller.id,
      categoryId: category.id,
      productType: model === 'SERVICE' ? 'SERVICE' : 'GAME',
      model,
      status: 'ACTIVE',
      slug: `product-${suffix}`,
      title: 'Original title',
      description: 'Public description',
      price: model === 'NORMAL' ? 10 : null,
      stock: model === 'NORMAL' ? stock : null,
      variants: {
        create:
          model === 'DYNAMIC'
            ? [
                { title: 'Dynamic A', price: 12, stock },
                { title: 'Dynamic B', price: 15, stock },
              ]
            : model === 'NORMAL'
              ? [{ title: 'Canonical', price: 10, stock }]
              : fixed
                ? [{ title: 'Service', price: 25, stock: 0 }]
                : [],
      },
      serviceDetails:
        model === 'SERVICE'
          ? {
              create: {
                pricingType: pricingType ?? 'QUOTE',
                basePrice: fixed ? 25 : null,
                estimatedDelivery: '2 days',
                buyerRequirements: 'Public requirements',
              },
            }
          : undefined,
      images: {
        create: {
          objectKey: `checkout/${suffix}`,
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
    include: { variants: true },
  });
  return { buyer, sellerUser, seller, category, draft, product };
}
