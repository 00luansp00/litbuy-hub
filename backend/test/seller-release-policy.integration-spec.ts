import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';
import {
  SELLER_RELEASE_POLICY_RULE_CODE,
  SellerReleasePolicyService,
} from '../src/financial/seller-release-policy.service';

describe('SellerReleasePolicy with real PostgreSQL', () => {
  jest.setTimeout(120_000);
  let app: Awaited<ReturnType<ReturnType<typeof Test.createTestingModule>['compile']>>;
  let prisma: PrismaService;
  let cleanup: PrismaClient;
  let service: SellerReleasePolicyService;
  let actorId: string;
  let categoryId: string;
  let subcategoryId: string;
  let version = 70_000;

  beforeAll(async () => {
    cleanup = new PrismaClient();
    app = await Test.createTestingModule({ imports: [AppModule] }).compile();
    prisma = app.get(PrismaService);
    service = app.get(SellerReleasePolicyService);
  });
  beforeEach(async () => {
    await cleanup.$executeRawUnsafe('TRUNCATE TABLE "User" CASCADE');
    const actor = await prisma.user.create({
      data: {
        email: `policy-${randomUUID()}@example.test`,
        birthDate: new Date('1990-01-01'),
        termsVersion: 'test',
        termsAcceptedAt: new Date(),
        privacyVersion: 'test',
        privacyAcceptedAt: new Date(),
      },
    });
    actorId = actor.id;
    const category = await prisma.catalogCategory.create({
      data: { slug: `category-${randomUUID()}`, name: 'Original category name' },
    });
    categoryId = category.id;
    subcategoryId = (
      await prisma.catalogSubcategory.create({
        data: {
          categoryId,
          slug: `subcategory-${randomUUID()}`,
          name: 'Original subcategory name',
        },
      })
    ).id;
  });
  afterAll(async () => {
    await app.close();
    await cleanup.$disconnect();
  });

  function draft(delayHours = 24, from = new Date(Date.now() - 60_000), to: Date | null = null) {
    return prisma.sellerReleasePolicyVersion.create({
      data: {
        publicVersion: version++,
        effectiveFrom: from,
        effectiveTo: to,
        createdByUserId: actorId,
        rules: {
          create: { code: SELLER_RELEASE_POLICY_RULE_CODE, delayHours, enabled: true },
        },
      },
      include: { rules: true },
    });
  }
  async function publish(id: string, status: 'SCHEDULED' | 'ACTIVE' | 'RETIRED' = 'ACTIVE') {
    return prisma.sellerReleasePolicyVersion.update({
      where: { id },
      data: { status, publishedByUserId: actorId, publishedAt: new Date() },
    });
  }
  async function expectCode(promise: Promise<unknown>, code: string) {
    await expect(promise).rejects.toMatchObject({ code });
  }

  it('creates and edits a DRAFT, with zero and positive integer delays', async () => {
    const policy = await draft(0);
    expect(policy.status).toBe('DRAFT');
    expect(policy.rules[0].delayHours).toBe(0);
    await prisma.sellerReleasePolicyRule.update({
      where: { id: policy.rules[0].id },
      data: { delayHours: 72 },
    });
    expect(
      (
        await prisma.sellerReleasePolicyRule.findUniqueOrThrow({
          where: { id: policy.rules[0].id },
        })
      ).delayHours,
    ).toBe(72);
  });

  it('enforces unique public versions and rule codes', async () => {
    const policy = await draft();
    await expect(
      prisma.sellerReleasePolicyVersion.create({
        data: {
          publicVersion: policy.publicVersion,
          effectiveFrom: new Date(),
          createdByUserId: actorId,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.sellerReleasePolicyRule.create({
        data: {
          policyVersionId: policy.id,
          code: SELLER_RELEASE_POLICY_RULE_CODE,
          delayHours: 168,
        },
      }),
    ).rejects.toBeDefined();
  });

  it('rejects negative delayHours and invalid effective windows in PostgreSQL', async () => {
    await expect(draft(-1)).rejects.toBeDefined();
    const now = new Date();
    await expect(draft(24, now, now)).rejects.toBeDefined();
    await expect(draft(24, now, new Date(now.getTime() - 1))).rejects.toBeDefined();
    await expect(draft(24, now, new Date(now.getTime() + 1_000))).resolves.toBeDefined();
  });

  it('fails closed when no policy is currently effective, including future and expired policies', async () => {
    await expectCode(service.resolveEffectivePolicy(), 'SELLER_RELEASE_POLICY_NOT_FOUND');
    const future = await draft(24, new Date(Date.now() + 3_600_000));
    await publish(future.id);
    await expectCode(service.resolveEffectivePolicy(), 'SELLER_RELEASE_POLICY_NOT_FOUND');
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: future.id },
      data: { status: 'RETIRED' },
    });
    const expired = await draft(
      24,
      new Date(Date.now() - 7_200_000),
      new Date(Date.now() - 3_600_000),
    );
    await publish(expired.id);
    await expectCode(service.resolveEffectivePolicy(), 'SELLER_RELEASE_POLICY_NOT_FOUND');
  });

  it('resolves one enabled global rule using the PostgreSQL effective time', async () => {
    const policy = await draft(72);
    await publish(policy.id);
    await expect(service.resolveEffectivePolicy()).resolves.toEqual({
      policyVersionId: policy.id,
      publicVersion: policy.publicVersion,
      ruleId: policy.rules[0].id,
      ruleCode: SELLER_RELEASE_POLICY_RULE_CODE,
      delayHours: 72,
      source: 'DEFAULT',
      categoryId: null,
      subcategoryId: null,
    });
  });

  it('fails closed for a disabled default rule', async () => {
    const disabled = await draft();
    await prisma.sellerReleasePolicyRule.update({
      where: { id: disabled.rules[0].id },
      data: { enabled: false },
    });
    await publish(disabled.id);
    await expectCode(service.resolveEffectivePolicy(), 'SELLER_RELEASE_POLICY_NOT_FOUND');
  });

  it('fails closed when an effective policy has no applicable override or DEFAULT', async () => {
    const policy = await draft();
    await prisma.sellerReleasePolicyRule.delete({ where: { id: policy.rules[0].id } });
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'OTHER_CATEGORY_ONLY',
        delayHours: 24,
        scope: 'CATEGORY',
        categoryId,
      },
    });
    await publish(policy.id);
    await expectCode(service.resolveEffectivePolicy(), 'SELLER_RELEASE_POLICY_NOT_FOUND');
  });

  it('resolves CATEGORY before DEFAULT, permits shorter and longer overrides, and ignores disabled overrides', async () => {
    const policy = await draft(168);
    const longerCategory = await prisma.catalogCategory.create({
      data: { slug: `longer-${randomUUID()}`, name: 'Longer' },
    });
    const shorter = await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'CATEGORY_SHORTER',
        delayHours: 96,
        scope: 'CATEGORY',
        categoryId,
      },
    });
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'CATEGORY_LONGER',
        delayHours: 240,
        scope: 'CATEGORY',
        categoryId: longerCategory.id,
      },
    });
    await publish(policy.id);

    await expect(service.resolveEffectivePolicy(undefined, { categoryId })).resolves.toMatchObject({
      ruleId: shorter.id,
      delayHours: 96,
      source: 'CATEGORY',
      categoryId,
      subcategoryId: null,
    });
    await expect(
      service.resolveEffectivePolicy(undefined, { categoryId: longerCategory.id }),
    ).resolves.toMatchObject({ delayHours: 240, source: 'CATEGORY' });
    await expect(service.resolveEffectivePolicy()).resolves.toMatchObject({
      delayHours: 168,
      source: 'DEFAULT',
    });

    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'RETIRED' },
    });
    const fallback = await draft(168);
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: fallback.id,
        code: 'CATEGORY_DISABLED',
        delayHours: 24,
        enabled: false,
        scope: 'CATEGORY',
        categoryId,
      },
    });
    await publish(fallback.id);
    await expect(service.resolveEffectivePolicy(undefined, { categoryId })).resolves.toMatchObject({
      source: 'DEFAULT',
      delayHours: 168,
    });
  });

  it('resolves SUBCATEGORY before CATEGORY and DEFAULT with explicit disabled fallback', async () => {
    const policy = await draft(168);
    const category = await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'CATEGORY',
        delayHours: 120,
        scope: 'CATEGORY',
        categoryId,
      },
    });
    const subcategory = await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'SUBCATEGORY',
        delayHours: 48,
        scope: 'SUBCATEGORY',
        subcategoryId,
      },
    });
    await publish(policy.id);
    await expect(
      service.resolveEffectivePolicy(undefined, { categoryId, subcategoryId }),
    ).resolves.toMatchObject({
      ruleId: subcategory.id,
      source: 'SUBCATEGORY',
      subcategoryId,
      categoryId: null,
    });

    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'RETIRED' },
    });
    const categoryFallback = await draft(168);
    await prisma.sellerReleasePolicyRule.createMany({
      data: [
        {
          policyVersionId: categoryFallback.id,
          code: 'CATEGORY',
          delayHours: 120,
          scope: 'CATEGORY',
          categoryId,
        },
        {
          policyVersionId: categoryFallback.id,
          code: 'SUBCATEGORY_DISABLED',
          delayHours: 48,
          enabled: false,
          scope: 'SUBCATEGORY',
          subcategoryId,
        },
      ],
    });
    await publish(categoryFallback.id);
    await expect(
      service.resolveEffectivePolicy(undefined, { categoryId, subcategoryId }),
    ).resolves.toMatchObject({ source: 'CATEGORY', delayHours: 120 });

    await prisma.sellerReleasePolicyVersion.update({
      where: { id: categoryFallback.id },
      data: { status: 'RETIRED' },
    });
    const defaultFallback = await draft(168);
    await prisma.sellerReleasePolicyRule.createMany({
      data: [
        {
          policyVersionId: defaultFallback.id,
          code: 'CATEGORY_DISABLED',
          delayHours: 120,
          enabled: false,
          scope: 'CATEGORY',
          categoryId,
        },
        {
          policyVersionId: defaultFallback.id,
          code: 'SUBCATEGORY_DISABLED',
          delayHours: 48,
          enabled: false,
          scope: 'SUBCATEGORY',
          subcategoryId,
        },
      ],
    });
    await publish(defaultFallback.id);
    await expect(
      service.resolveEffectivePolicy(undefined, { categoryId, subcategoryId }),
    ).resolves.toMatchObject({ source: 'DEFAULT', delayHours: 168 });
    expect(category.id).toBeDefined();
  });

  it('uses stable catalog IDs after category and subcategory labels change', async () => {
    const policy = await draft(168);
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'STABLE_SUBCATEGORY',
        delayHours: 96,
        scope: 'SUBCATEGORY',
        subcategoryId,
      },
    });
    await publish(policy.id);
    await prisma.catalogCategory.update({
      where: { id: categoryId },
      data: { name: 'Renamed', slug: `renamed-${randomUUID()}` },
    });
    await prisma.catalogSubcategory.update({
      where: { id: subcategoryId },
      data: { name: 'Renamed too', slug: `renamed-sub-${randomUUID()}` },
    });
    await expect(
      service.resolveEffectivePolicy(undefined, { categoryId, subcategoryId }),
    ).resolves.toMatchObject({
      source: 'SUBCATEGORY',
      subcategoryId,
      delayHours: 96,
    });
  });

  it('enforces scope shapes, one qualifier per version, and catalog foreign keys in PostgreSQL', async () => {
    const policy = await draft();
    await expect(
      prisma.sellerReleasePolicyRule.create({
        data: { policyVersionId: policy.id, code: 'SECOND_DEFAULT', delayHours: 1 },
      }),
    ).rejects.toBeDefined();
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'CATEGORY',
        delayHours: 1,
        scope: 'CATEGORY',
        categoryId,
      },
    });
    await expect(
      prisma.sellerReleasePolicyRule.create({
        data: {
          policyVersionId: policy.id,
          code: 'CATEGORY_2',
          delayHours: 2,
          scope: 'CATEGORY',
          categoryId,
        },
      }),
    ).rejects.toBeDefined();
    await prisma.sellerReleasePolicyRule.create({
      data: {
        policyVersionId: policy.id,
        code: 'SUBCATEGORY',
        delayHours: 1,
        scope: 'SUBCATEGORY',
        subcategoryId,
      },
    });
    await expect(
      prisma.sellerReleasePolicyRule.create({
        data: {
          policyVersionId: policy.id,
          code: 'SUBCATEGORY_2',
          delayHours: 2,
          scope: 'SUBCATEGORY',
          subcategoryId,
        },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.$executeRaw`INSERT INTO "SellerReleasePolicyRule" ("id", "policyVersionId", "code", "delayHours", "enabled", "scope", "categoryId", "updatedAt") VALUES (${randomUUID()}::uuid, ${policy.id}::uuid, 'INVALID_SHAPE', 1, true, 'DEFAULT', ${categoryId}::uuid, now())`,
    ).rejects.toBeDefined();
    await expect(
      prisma.sellerReleasePolicyRule.create({
        data: {
          policyVersionId: policy.id,
          code: 'MISSING_FK',
          delayHours: 1,
          scope: 'CATEGORY',
          categoryId: randomUUID(),
        },
      }),
    ).rejects.toBeDefined();
  });

  it('requires publication audit metadata and enforces lifecycle transitions', async () => {
    const policy = await draft();
    await expect(
      prisma.sellerReleasePolicyVersion.update({
        where: { id: policy.id },
        data: { status: 'ACTIVE' },
      }),
    ).rejects.toBeDefined();
    await publish(policy.id);
    await expect(
      prisma.sellerReleasePolicyVersion.update({
        where: { id: policy.id },
        data: { status: 'DRAFT' },
      }),
    ).rejects.toBeDefined();
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: policy.id },
      data: { status: 'RETIRED' },
    });
    expect(
      (await prisma.sellerReleasePolicyVersion.findUniqueOrThrow({ where: { id: policy.id } }))
        .status,
    ).toBe('RETIRED');
  });

  it('makes published identity, dates, creator, rules and deletion immutable', async () => {
    const policy = await draft();
    await publish(policy.id);
    for (const data of [
      { publicVersion: version++ },
      { effectiveFrom: new Date(Date.now() - 100_000) },
      { createdByUserId: randomUUID() },
    ]) {
      await expect(
        prisma.sellerReleasePolicyVersion.update({ where: { id: policy.id }, data }),
      ).rejects.toBeDefined();
    }
    await expect(
      prisma.sellerReleasePolicyRule.update({
        where: { id: policy.rules[0].id },
        data: { delayHours: 168 },
      }),
    ).rejects.toBeDefined();
    await expect(
      prisma.sellerReleasePolicyRule.delete({ where: { id: policy.rules[0].id } }),
    ).rejects.toBeDefined();
  });

  it('serializes concurrent overlapping publication so at most one succeeds', async () => {
    const first = await draft();
    const second = await draft();
    const results = await Promise.allSettled([publish(first.id), publish(second.id)]);
    expect(results.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(await prisma.sellerReleasePolicyVersion.count({ where: { status: 'ACTIVE' } })).toBe(1);
  });

  it('preserves retired history and permits correction only through a new version', async () => {
    const historical = await draft(24);
    await publish(historical.id);
    await prisma.sellerReleasePolicyVersion.update({
      where: { id: historical.id },
      data: { status: 'RETIRED' },
    });
    const replacement = await draft(168);
    await publish(replacement.id);
    expect(
      (
        await prisma.sellerReleasePolicyVersion.findUniqueOrThrow({
          where: { id: historical.id },
          include: { rules: true },
        })
      ).rules[0].delayHours,
    ).toBe(24);
    expect((await service.resolveEffectivePolicy()).delayHours).toBe(168);
  });

  it('is read-only and creates no money movement, hold, withdrawal, or settlement', async () => {
    const before = await Promise.all([
      prisma.ledgerTransaction.count(),
      prisma.ledgerEntry.count(),
      prisma.financialHold.count(),
      prisma.withdrawal.count(),
      prisma.settlement.count(),
    ]);
    const policy = await draft();
    await publish(policy.id);
    await service.resolveEffectivePolicy();
    expect(
      await Promise.all([
        prisma.ledgerTransaction.count(),
        prisma.ledgerEntry.count(),
        prisma.financialHold.count(),
        prisma.withdrawal.count(),
        prisma.settlement.count(),
      ]),
    ).toEqual(before);
  });
});
