import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import type { AuthMailer } from '../src/auth/auth.service';
import type { PrismaService } from '../src/database/prisma.service';
import type { Prisma } from '@prisma/client';

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

export async function publishPlatformCommissionPolicy(
  prisma: PrismaService,
  createdByUserId: string,
  options: {
    publicVersion?: number;
    formula?: 'FIXED' | 'PERCENT_BPS' | 'PERCENT_BPS_PLUS_FIXED';
    percentBps?: number | null;
    fixedAmountMinor?: bigint | null;
    minimumAmountMinor?: bigint | null;
    maximumAmountMinor?: bigint | null;
    status?: 'DRAFT' | 'SCHEDULED' | 'ACTIVE' | 'RETIRED';
    effectiveFrom?: Date;
    effectiveTo?: Date | null;
    rule?: Partial<Prisma.FeeRuleUncheckedCreateInput>;
    additionalRules?: Array<Partial<Prisma.FeeRuleUncheckedCreateInput>>;
  } = {},
) {
  const formula =
    options.formula ?? (options.fixedAmountMinor !== undefined ? 'FIXED' : 'PERCENT_BPS');
  const percentBps = options.percentBps ?? (formula === 'FIXED' ? null : 999);
  const fixedAmountMinor = options.fixedAmountMinor ?? (formula === 'PERCENT_BPS' ? null : 0n);
  return prisma.$transaction(async (tx) => {
    const policy = await tx.feePolicyVersion.create({
      data: {
        publicVersion: options.publicVersion ?? 1,
        status: 'DRAFT',
        effectiveFrom: options.effectiveFrom ?? new Date(Date.now() - 60_000),
        effectiveTo: options.effectiveTo,
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: new Date(),
        rules: {
          create: [
            {
              code: `platform-commission-${crypto.randomUUID()}`,
              category: 'PLATFORM_COMMISSION',
              partyCharged: 'SELLER',
              formula,
              percentBps,
              fixedAmountMinor,
              minimumAmountMinor: options.minimumAmountMinor,
              maximumAmountMinor: options.maximumAmountMinor,
              promotionTier: 'SILVER',
              ...options.rule,
            },
            ...(options.additionalRules ?? []).map((rule) => ({
              code: `platform-commission-${crypto.randomUUID()}`,
              category: 'PLATFORM_COMMISSION' as const,
              partyCharged: 'SELLER' as const,
              formula: 'PERCENT_BPS' as const,
              percentBps: 999,
              fixedAmountMinor: null,
              promotionTier: 'SILVER',
              ...rule,
            })),
          ],
        },
      },
    });
    return tx.feePolicyVersion.update({
      where: { id: policy.id },
      data: { status: options.status ?? 'ACTIVE' },
      include: { rules: true },
    });
  });
}

export async function publishSellerReleasePolicy(
  prisma: PrismaService,
  createdByUserId: string,
  delayHours = 168,
) {
  const publicVersion =
    (await prisma.sellerReleasePolicyVersion.aggregate({ _max: { publicVersion: true } }))._max
      .publicVersion ?? 0;
  return prisma.$transaction(async (tx) => {
    const policy = await tx.sellerReleasePolicyVersion.create({
      data: {
        publicVersion: publicVersion + 1,
        status: 'DRAFT',
        effectiveFrom: new Date(Date.now() - 60_000),
        createdByUserId,
        publishedByUserId: createdByUserId,
        publishedAt: new Date(),
        rules: {
          create: {
            code: `checkout-default-${crypto.randomUUID()}`,
            delayHours,
            scope: 'DEFAULT',
          },
        },
      },
    });
    return tx.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'ACTIVE' },
      include: { rules: true },
    });
  });
}

export async function commerceFixture(
  prisma: PrismaService,
  model: 'NORMAL' | 'DYNAMIC' | 'SERVICE' = 'NORMAL',
  pricingType?: 'FIXED' | 'QUOTE',
  stock = 5,
  withZeroCommissionPolicy = true,
  withDefaultReleasePolicy = true,
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
  if (
    withZeroCommissionPolicy &&
    (await prisma.feePolicyVersion.count({ where: { status: 'ACTIVE' } })) === 0
  )
    await publishPlatformCommissionPolicy(prisma, sellerUser.id);
  if (
    withDefaultReleasePolicy &&
    (await prisma.sellerReleasePolicyVersion.count({ where: { status: 'ACTIVE' } })) === 0
  )
    await publishSellerReleasePolicy(prisma, sellerUser.id);
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
      requestedPromotionTier: 'SILVER',
    },
  });
  const fixed = model === 'SERVICE' && pricingType === 'FIXED';
  const product = await prisma.product.create({
    data: {
      listingTier: 'SILVER',
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
