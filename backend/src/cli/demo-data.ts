import 'reflect-metadata';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { createHash } from 'node:crypto';
import { hashPassword } from '../auth/auth.utils';
import {
  DEMO_CATEGORIES,
  DEMO_DATE,
  DEMO_IDS,
  DEMO_IMAGES,
  DEMO_PRODUCTS,
  DEMO_SUMMARY,
  DEMO_USERS,
} from './demo-data.fixtures';
import { PublicCatalogSort } from '../products/public-product-catalog.dto';
import { PublicProductCatalogService } from '../products/public-product-catalog.service';
import { assertDemoEnvironment, DemoDataError, parseDemoCommand } from './demo-data.guard';
import type { DemoRuntimeConfig } from './demo-data.guard';

type Runtime = ReturnType<typeof runtime>;
const s3 = (config: DemoRuntimeConfig, endpoint: string) =>
  new S3Client({
    endpoint,
    region: config.s3Region,
    forcePathStyle: config.forcePathStyle,
    credentials: {
      accessKeyId: config.s3AccessKey,
      secretAccessKey: config.s3SecretKey,
    },
  });
function runtime(config: DemoRuntimeConfig) {
  return {
    config,
    prisma: new PrismaClient({ datasourceUrl: config.databaseUrl }),
    internalS3: s3(config, config.s3Endpoint),
    signingS3: s3(config, config.s3SigningEndpoint),
  };
}

async function assertNoNamespaceConflicts({ prisma }: Runtime) {
  for (const user of DEMO_USERS) {
    const [byEmail, byId] = await Promise.all([
      prisma.user.findUnique({ where: { email: user.email }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: user.id }, select: { email: true } }),
    ]);
    if ((byEmail && byEmail.id !== user.id) || (byId && byId.email !== user.email))
      throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  }
  for (const category of DEMO_CATEGORIES) {
    const [bySlug, byId] = await Promise.all([
      prisma.catalogCategory.findUnique({ where: { slug: category.slug }, select: { id: true } }),
      prisma.catalogCategory.findUnique({ where: { id: category.id }, select: { slug: true } }),
    ]);
    if ((bySlug && bySlug.id !== category.id) || (byId && byId.slug !== category.slug))
      throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    for (const sub of category.subcategories) {
      const [subById, subBySlug] = await Promise.all([
        prisma.catalogSubcategory.findUnique({ where: { id: sub.id } }),
        prisma.catalogSubcategory.findUnique({
          where: { categoryId_slug: { categoryId: category.id, slug: sub.slug } },
        }),
      ]);
      if (
        (subById && (subById.slug !== sub.slug || subById.categoryId !== category.id)) ||
        (subBySlug && subBySlug.id !== sub.id)
      )
        throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    }
  }
  const [application, applicationByUser, profile, profileByUser, profileBySlug] = await Promise.all(
    [
      prisma.sellerApplication.findUnique({ where: { id: DEMO_IDS.sellerApplication } }),
      prisma.sellerApplication.findUnique({ where: { userId: DEMO_IDS.users.seller } }),
      prisma.sellerProfile.findUnique({ where: { id: DEMO_IDS.sellerProfile } }),
      prisma.sellerProfile.findUnique({ where: { userId: DEMO_IDS.users.seller } }),
      prisma.sellerProfile.findUnique({ where: { slug: 'demo-lit-store' } }),
    ],
  );
  if (
    (application && application.userId !== DEMO_IDS.users.seller) ||
    (applicationByUser && applicationByUser.id !== DEMO_IDS.sellerApplication) ||
    (profile && (profile.userId !== DEMO_IDS.users.seller || profile.slug !== 'demo-lit-store')) ||
    (profileByUser && profileByUser.id !== DEMO_IDS.sellerProfile) ||
    (profileBySlug && profileBySlug.id !== DEMO_IDS.sellerProfile)
  )
    throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  for (const product of DEMO_PRODUCTS) {
    const [slug, key, byId, draft, productByDraft, imageById] = await Promise.all([
      prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } }),
      prisma.productImage.findUnique({
        where: { objectKey: product.objectKey },
        select: { id: true },
      }),
      prisma.product.findUnique({
        where: { id: product.id },
        select: { slug: true, sourceListingDraftId: true, sellerProfileId: true },
      }),
      prisma.listingDraft.findUnique({
        where: { id: product.draftId },
        select: { sellerProfileId: true },
      }),
      prisma.product.findUnique({
        where: { sourceListingDraftId: product.draftId },
        select: { id: true },
      }),
      prisma.productImage.findUnique({ where: { id: product.imageId } }),
    ]);
    const [wrongVariants, wrongDraftVariants] = await Promise.all([
      prisma.productVariant.count({
        where: { id: { in: product.variants.map((v) => v.id) }, NOT: { productId: product.id } },
      }),
      prisma.listingDraftVariant.count({
        where: {
          id: { in: product.variants.map((v) => v.draftId) },
          NOT: { draftId: product.draftId },
        },
      }),
    ]);
    if (
      (slug && slug.id !== product.id) ||
      (key && key.id !== product.imageId) ||
      (byId &&
        (byId.slug !== product.slug ||
          byId.sourceListingDraftId !== product.draftId ||
          byId.sellerProfileId !== DEMO_IDS.sellerProfile)) ||
      (draft && draft.sellerProfileId !== DEMO_IDS.sellerProfile) ||
      (productByDraft && productByDraft.id !== product.id) ||
      (imageById &&
        (imageById.objectKey !== product.objectKey || imageById.productId !== product.id)) ||
      wrongVariants ||
      wrongDraftVariants
    )
      throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  }
}

async function objectBytes(body: unknown) {
  return Buffer.from(
    await (body as { transformToByteArray(): Promise<Uint8Array> }).transformToByteArray(),
  );
}
async function uploadImages({ config, internalS3 }: Runtime) {
  for (const image of DEMO_IMAGES) {
    try {
      const head = await internalS3.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
      );
      const object = await internalS3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
      );
      const actual = createHash('sha256')
        .update(await objectBytes(object.Body))
        .digest('hex');
      if (
        head.ContentType !== image.contentType ||
        head.ContentLength !== image.body.length ||
        actual !== image.sha256
      )
        throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    } catch (error) {
      if (error instanceof DemoDataError) throw error;
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404)
        throw error;
      await internalS3.send(
        new PutObjectCommand({
          Bucket: config.bucket,
          Key: image.objectKey,
          Body: image.body,
          ContentType: image.contentType,
        }),
      );
    }
  }
}

async function assertNoStorageConflicts({ config, internalS3 }: Runtime) {
  for (const image of DEMO_IMAGES) {
    try {
      const head = await internalS3.send(
        new HeadObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
      );
      const object = await internalS3.send(
        new GetObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
      );
      const hash = createHash('sha256')
        .update(await objectBytes(object.Body))
        .digest('hex');
      if (
        head.ContentType !== image.contentType ||
        head.ContentLength !== image.body.length ||
        hash !== image.sha256
      )
        throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    } catch (error) {
      if (error instanceof DemoDataError) throw error;
      if ((error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode !== 404)
        throw error;
    }
  }
}

async function seed(context: Runtime) {
  const { prisma, config } = context;
  await assertNoNamespaceConflicts(context);
  await uploadImages(context);
  const passwordHash = await hashPassword(config.password);
  await prisma.$transaction(async (tx) => {
    for (const user of DEMO_USERS) {
      await tx.user.upsert({
        where: { id: user.id },
        create: {
          id: user.id,
          email: user.email,
          phoneE164: null,
          phoneVerifiedAt: null,
          birthDate: new Date('1995-01-01'),
          status: 'ACTIVE',
          emailVerifiedAt: DEMO_DATE,
          termsVersion: config.termsVersion,
          termsAcceptedAt: DEMO_DATE,
          privacyVersion: config.privacyVersion,
          privacyAcceptedAt: DEMO_DATE,
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
          deletedAt: null,
          sensitiveActionHoldUntil: null,
          lastSensitiveChangeAt: null,
        },
        update: {
          email: user.email,
          phoneE164: null,
          phoneVerifiedAt: null,
          birthDate: new Date('1995-01-01'),
          status: 'ACTIVE',
          emailVerifiedAt: DEMO_DATE,
          deletedAt: null,
          sensitiveActionHoldUntil: null,
          lastSensitiveChangeAt: null,
          termsVersion: config.termsVersion,
          termsAcceptedAt: DEMO_DATE,
          privacyVersion: config.privacyVersion,
          privacyAcceptedAt: DEMO_DATE,
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
      });
      await tx.passwordCredential.upsert({
        where: { userId: user.id },
        create: {
          userId: user.id,
          passwordHash,
          passwordChangedAt: DEMO_DATE,
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
        update: {
          passwordHash,
          passwordChangedAt: DEMO_DATE,
          failedLoginAttempts: 0,
          lockedUntil: null,
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
      });
      await tx.userRoleAssignment.deleteMany({ where: { userId: user.id } });
      await tx.userRoleAssignment.createMany({
        data: user.roles.map((role) => ({ userId: user.id, role, grantedAt: DEMO_DATE })),
      });
    }
    await tx.sellerApplication.upsert({
      where: { id: DEMO_IDS.sellerApplication },
      create: {
        id: DEMO_IDS.sellerApplication,
        userId: DEMO_IDS.users.seller,
        storeName: 'LIT Demo Store',
        requestedSlug: 'demo-lit-store',
        description: 'Loja fictícia para demonstração local.',
        status: 'APPROVED',
        sellerAgreementVersion: config.sellerAgreementVersion,
        sellerAgreementAcceptedAt: DEMO_DATE,
        submittedAt: DEMO_DATE,
        reviewedAt: DEMO_DATE,
        reviewedByUserId: DEMO_IDS.users.admin,
        rejectionCode: null,
        rejectionReason: null,
        createdAt: DEMO_DATE,
        updatedAt: DEMO_DATE,
      },
      update: {
        userId: DEMO_IDS.users.seller,
        storeName: 'LIT Demo Store',
        requestedSlug: 'demo-lit-store',
        description: 'Loja fictícia para demonstração local.',
        status: 'APPROVED',
        sellerAgreementVersion: config.sellerAgreementVersion,
        sellerAgreementAcceptedAt: DEMO_DATE,
        submittedAt: DEMO_DATE,
        reviewedAt: DEMO_DATE,
        reviewedByUserId: DEMO_IDS.users.admin,
        rejectionCode: null,
        rejectionReason: null,
        createdAt: DEMO_DATE,
        updatedAt: DEMO_DATE,
      },
    });
    await tx.sellerProfile.upsert({
      where: { id: DEMO_IDS.sellerProfile },
      create: {
        id: DEMO_IDS.sellerProfile,
        userId: DEMO_IDS.users.seller,
        storeName: 'LIT Demo Store',
        slug: 'demo-lit-store',
        description: 'Loja fictícia para demonstração local.',
        status: 'ACTIVE',
        verified: true,
        createdAt: DEMO_DATE,
        updatedAt: DEMO_DATE,
      },
      update: {
        userId: DEMO_IDS.users.seller,
        storeName: 'LIT Demo Store',
        slug: 'demo-lit-store',
        description: 'Loja fictícia para demonstração local.',
        status: 'ACTIVE',
        verified: true,
        createdAt: DEMO_DATE,
        updatedAt: DEMO_DATE,
      },
    });
    for (const category of DEMO_CATEGORIES) {
      await tx.catalogCategory.upsert({
        where: { id: category.id },
        create: {
          id: category.id,
          slug: category.slug,
          name: category.name,
          description: 'Taxonomia fictícia de demonstração.',
          iconKey: null,
          colorHex: null,
          sortOrder: category.sortOrder,
          featured: false,
          status: 'ACTIVE',
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
        update: {
          slug: category.slug,
          name: category.name,
          description: 'Taxonomia fictícia de demonstração.',
          iconKey: null,
          colorHex: null,
          sortOrder: category.sortOrder,
          featured: false,
          status: 'ACTIVE',
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
      });
      for (const sub of category.subcategories)
        await tx.catalogSubcategory.upsert({
          where: { id: sub.id },
          create: {
            ...sub,
            categoryId: category.id,
            status: 'ACTIVE',
            createdAt: DEMO_DATE,
            updatedAt: DEMO_DATE,
          },
          update: {
            slug: sub.slug,
            name: sub.name,
            categoryId: category.id,
            sortOrder: sub.sortOrder,
            status: 'ACTIVE',
            createdAt: DEMO_DATE,
            updatedAt: DEMO_DATE,
          },
        });
    }
    for (const item of DEMO_PRODUCTS) {
      await tx.listingDraft.upsert({
        where: { id: item.draftId },
        create: {
          id: item.draftId,
          sellerProfileId: DEMO_IDS.sellerProfile,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          productType: item.productType,
          model: item.model,
          status: 'APPROVED',
          title: item.title,
          description: item.description,
          price: item.price,
          stock: item.stock,
          deliveryMode: 'MANUAL',
          requestedPromotionTier: 'SILVER',
          requestedSellerPlan: 'STANDARD',
          autoMessage: null,
          notifyInApp: true,
          notifyBrowser: false,
          notifyEmailFuture: false,
          notifyExternalFuture: false,
          wizardStep: 1,
          version: 1,
          submittedAt: item.createdAt,
          reviewStartedAt: item.createdAt,
          reviewedAt: item.createdAt,
          approvedAt: item.createdAt,
          reviewedByUserId: DEMO_IDS.users.admin,
          rejectionCode: null,
          rejectionReason: null,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
        update: {
          sellerProfileId: DEMO_IDS.sellerProfile,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          productType: item.productType,
          model: item.model,
          status: 'APPROVED',
          title: item.title,
          description: item.description,
          price: item.price,
          stock: item.stock,
          deliveryMode: 'MANUAL',
          requestedPromotionTier: 'SILVER',
          requestedSellerPlan: 'STANDARD',
          autoMessage: null,
          notifyInApp: true,
          notifyBrowser: false,
          notifyEmailFuture: false,
          notifyExternalFuture: false,
          wizardStep: 1,
          version: 1,
          submittedAt: item.createdAt,
          reviewStartedAt: item.createdAt,
          reviewedAt: item.createdAt,
          reviewedByUserId: DEMO_IDS.users.admin,
          approvedAt: item.createdAt,
          rejectionCode: null,
          rejectionReason: null,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      await tx.product.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          sourceListingDraftId: item.draftId,
          sellerProfileId: DEMO_IDS.sellerProfile,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          productType: item.productType,
          model: item.model,
          status: item.status,
          slug: item.slug,
          title: item.title,
          description: item.description,
          price: item.price,
          stock: item.stock,
          deliveryMode: 'MANUAL',
          autoMessage: null,
          version: 1,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
        update: {
          sourceListingDraftId: item.draftId,
          sellerProfileId: DEMO_IDS.sellerProfile,
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          productType: item.productType,
          model: item.model,
          status: item.status,
          slug: item.slug,
          title: item.title,
          description: item.description,
          price: item.price,
          stock: item.stock,
          deliveryMode: 'MANUAL',
          autoMessage: null,
          version: 1,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
      await tx.listingDraftVariant.deleteMany({ where: { draftId: item.draftId } });
      await tx.productVariant.deleteMany({ where: { productId: item.id } });
      await tx.listingDraftAttributeValue.deleteMany({ where: { draftId: item.draftId } });
      await tx.productAttributeValue.deleteMany({ where: { productId: item.id } });
      for (const variant of item.variants) {
        await tx.listingDraftVariant.create({
          data: {
            id: variant.draftId,
            draftId: item.draftId,
            title: variant.title,
            description: null,
            price: variant.price,
            stock: variant.stock,
            sortOrder: variant.sortOrder,
            status: 'ACTIVE',
          },
        });
        await tx.productVariant.create({
          data: {
            id: variant.id,
            productId: item.id,
            title: variant.title,
            description: null,
            price: variant.price,
            stock: variant.stock,
            sortOrder: variant.sortOrder,
            status: 'ACTIVE',
          },
        });
      }
      await tx.listingDraftServiceDetails.deleteMany({ where: { draftId: item.draftId } });
      await tx.productServiceDetails.deleteMany({ where: { productId: item.id } });
      await tx.listingDraftAccountDetails.deleteMany({ where: { draftId: item.draftId } });
      await tx.productAccountDetails.deleteMany({ where: { productId: item.id } });
      if (item.productType === 'ACCOUNT') {
        const account = {
          provenance: 'ORIGINAL_OWNER' as const,
          recoveryLevel: 'FULL' as const,
          emailVerified: true,
          phoneLinked: false,
          documentLinked: false,
          fullAccess: true,
          recoveryRisk: 'LOW' as const,
          warrantyNote:
            'Informação exclusivamente demonstrativa; nenhuma credencial real incluída.',
        };
        await tx.listingDraftAccountDetails.create({ data: { draftId: item.draftId, ...account } });
        await tx.productAccountDetails.create({ data: { productId: item.id, ...account } });
      }
      if (item.service) {
        const basePrice = item.service === 'FIXED' ? 79.9 : null;
        await tx.listingDraftServiceDetails.create({
          data: {
            draftId: item.draftId,
            pricingType: item.service,
            basePrice,
            estimatedDelivery: 'Até 2 dias úteis',
            buyerRequirements: 'Descreva apenas o objetivo fictício da demonstração.',
            notes: null,
          },
        });
        await tx.productServiceDetails.create({
          data: {
            productId: item.id,
            pricingType: item.service,
            basePrice,
            estimatedDelivery: 'Até 2 dias úteis',
            buyerRequirements: 'Descreva apenas o objetivo fictício da demonstração.',
            notes: null,
          },
        });
      }
      await tx.productImage.deleteMany({
        where: { productId: item.id, id: { not: item.imageId } },
      });
      const image = DEMO_IMAGES.find((candidate) => candidate.id === item.imageId)!;
      await tx.productImage.upsert({
        where: { id: item.imageId },
        create: {
          id: item.imageId,
          productId: item.id,
          objectKey: item.objectKey,
          status: 'READY',
          contentType: 'image/png',
          sizeBytes: image.body.length,
          altText: item.title,
          sortOrder: 0,
          isCover: true,
          uploadedAt: DEMO_DATE,
          uploadExpiresAt: new Date('2099-01-01'),
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
        update: {
          productId: item.id,
          objectKey: item.objectKey,
          status: 'READY',
          contentType: 'image/png',
          sizeBytes: image.body.length,
          altText: item.title,
          sortOrder: 0,
          isCover: true,
          uploadedAt: DEMO_DATE,
          uploadExpiresAt: new Date('2099-01-01'),
          deletedAt: null,
          createdAt: item.createdAt,
          updatedAt: item.createdAt,
        },
      });
    }
  });
  await verify(context);
  return { ok: true, action: 'seed', ...DEMO_SUMMARY };
}

async function verify(context: Runtime) {
  const { prisma, config, internalS3, signingS3 } = context;
  const fail = () => {
    throw new DemoDataError('DEMO_DATA_VERIFICATION_FAILED');
  };
  const users = await prisma.user.findMany({
    where: { id: { in: DEMO_USERS.map((x) => x.id) } },
    include: { passwordCredential: true, roleAssignments: true },
  });
  if (users.length !== DEMO_USERS.length) fail();
  for (const expected of DEMO_USERS) {
    const user = users.find((candidate) => candidate.id === expected.id);
    if (
      !user?.passwordCredential ||
      user.email !== expected.email ||
      user.status !== 'ACTIVE' ||
      user.phoneE164 !== null ||
      user.phoneVerifiedAt !== null ||
      !user.emailVerifiedAt ||
      user.deletedAt ||
      user.sensitiveActionHoldUntil !== null ||
      user.lastSensitiveChangeAt !== null ||
      user.birthDate.toISOString() !== new Date('1995-01-01').toISOString() ||
      user.termsVersion !== config.termsVersion ||
      user.privacyVersion !== config.privacyVersion ||
      user.passwordCredential.failedLoginAttempts !== 0 ||
      user.passwordCredential.lockedUntil ||
      !(await argon2.verify(user.passwordCredential.passwordHash, config.password)) ||
      user.roleAssignments
        .map((role) => role.role)
        .sort()
        .join() !== [...expected.roles].sort().join()
    )
      fail();
  }
  const [application, seller, categories, products] = await Promise.all([
    prisma.sellerApplication.findUnique({ where: { id: DEMO_IDS.sellerApplication } }),
    prisma.sellerProfile.findUnique({ where: { id: DEMO_IDS.sellerProfile } }),
    prisma.catalogCategory.findMany({
      where: { id: { in: DEMO_CATEGORIES.map((x) => x.id) } },
      include: { subcategories: true },
    }),
    prisma.product.findMany({
      where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } },
      include: {
        sourceListingDraft: {
          include: { variants: true, accountDetails: true, serviceDetails: true, attributes: true },
        },
        variants: true,
        accountDetails: true,
        serviceDetails: true,
        attributes: true,
        images: true,
      },
    }),
  ]);
  if (
    !application ||
    application.userId !== DEMO_IDS.users.seller ||
    application.status !== 'APPROVED' ||
    application.storeName !== 'LIT Demo Store' ||
    application.requestedSlug !== 'demo-lit-store' ||
    application.description !== 'Loja fictícia para demonstração local.' ||
    application.sellerAgreementVersion !== config.sellerAgreementVersion ||
    application.reviewedByUserId !== DEMO_IDS.users.admin ||
    !application.sellerAgreementAcceptedAt ||
    !seller ||
    seller.userId !== DEMO_IDS.users.seller ||
    seller.slug !== 'demo-lit-store' ||
    seller.storeName !== 'LIT Demo Store' ||
    seller.description !== 'Loja fictícia para demonstração local.' ||
    seller.status !== 'ACTIVE' ||
    !seller.verified ||
    categories.length !== 3 ||
    categories.flatMap((x) => x.subcategories).length !== 8 ||
    products.length !== 8
  )
    fail();
  for (const expected of DEMO_CATEGORIES) {
    const category = categories.find((candidate) => candidate.id === expected.id);
    if (!category) {
      fail();
      continue;
    }
    if (
      category.slug !== expected.slug ||
      category.name !== expected.name ||
      category.description !== 'Taxonomia fictícia de demonstração.' ||
      category.iconKey !== null ||
      category.colorHex !== null ||
      category.featured ||
      category.sortOrder !== expected.sortOrder ||
      category.status !== 'ACTIVE'
    )
      fail();
    for (const expectedSubcategory of expected.subcategories) {
      const subcategory = category.subcategories.find(
        (candidate) => candidate.id === expectedSubcategory.id,
      );
      if (
        !subcategory ||
        subcategory.categoryId !== expected.id ||
        subcategory.slug !== expectedSubcategory.slug ||
        subcategory.name !== expectedSubcategory.name ||
        subcategory.sortOrder !== expectedSubcategory.sortOrder ||
        subcategory.status !== 'ACTIVE'
      )
        fail();
    }
  }
  for (const expected of DEMO_PRODUCTS) {
    const product = products.find((candidate) => candidate.id === expected.id);
    if (!product) {
      fail();
      continue;
    }
    if (
      product.slug !== expected.slug ||
      product.sourceListingDraftId !== expected.draftId ||
      product.sellerProfileId !== DEMO_IDS.sellerProfile ||
      product.categoryId !== expected.categoryId ||
      product.subcategoryId !== expected.subcategoryId ||
      product.productType !== expected.productType ||
      product.model !== expected.model ||
      product.status !== expected.status ||
      product.title !== expected.title ||
      product.description !== expected.description ||
      Number(product.price) !== Number(expected.price) ||
      product.stock !== expected.stock ||
      product.deliveryMode !== 'MANUAL' ||
      product.autoMessage !== null ||
      product.version !== 1 ||
      product.createdAt.toISOString() !== expected.createdAt.toISOString() ||
      product.updatedAt.toISOString() !== expected.createdAt.toISOString() ||
      product.sourceListingDraft.status !== 'APPROVED' ||
      product.sourceListingDraft.sellerProfileId !== DEMO_IDS.sellerProfile ||
      product.sourceListingDraft.categoryId !== expected.categoryId ||
      product.sourceListingDraft.subcategoryId !== expected.subcategoryId ||
      product.sourceListingDraft.productType !== expected.productType ||
      product.sourceListingDraft.model !== expected.model ||
      product.sourceListingDraft.title !== expected.title ||
      product.sourceListingDraft.description !== expected.description ||
      Number(product.sourceListingDraft.price) !== Number(expected.price) ||
      product.sourceListingDraft.stock !== expected.stock ||
      product.sourceListingDraft.deliveryMode !== 'MANUAL' ||
      product.sourceListingDraft.autoMessage !== null ||
      product.sourceListingDraft.version !== 1 ||
      product.sourceListingDraft.createdAt.toISOString() !== expected.createdAt.toISOString() ||
      product.sourceListingDraft.updatedAt.toISOString() !== expected.createdAt.toISOString() ||
      product.variants.length !== expected.variants.length ||
      product.sourceListingDraft.variants.length !== expected.variants.length ||
      product.attributes.length ||
      product.sourceListingDraft.attributes.length ||
      product.images.length !== 1 ||
      product.images[0].status !== 'READY' ||
      !product.images[0].isCover ||
      product.images[0].objectKey !== expected.objectKey
    )
      fail();
    for (const expectedVariant of expected.variants) {
      const variant = product.variants.find((candidate) => candidate.id === expectedVariant.id);
      const draftVariant = product.sourceListingDraft.variants.find(
        (candidate) => candidate.id === expectedVariant.draftId,
      );
      if (
        !variant ||
        variant.productId !== expected.id ||
        variant.title !== expectedVariant.title ||
        variant.description !== null ||
        Number(variant.price) !== expectedVariant.price ||
        variant.stock !== expectedVariant.stock ||
        variant.status !== 'ACTIVE' ||
        variant.sortOrder !== expectedVariant.sortOrder ||
        !draftVariant ||
        draftVariant.draftId !== expected.draftId ||
        draftVariant.title !== expectedVariant.title ||
        draftVariant.description !== null ||
        Number(draftVariant.price) !== expectedVariant.price ||
        draftVariant.stock !== expectedVariant.stock ||
        draftVariant.status !== 'ACTIVE' ||
        draftVariant.sortOrder !== expectedVariant.sortOrder
      )
        fail();
    }
    const image = DEMO_IMAGES.find((candidate) => candidate.id === expected.imageId)!;
    const storedImage = product.images[0];
    if (
      storedImage.id !== expected.imageId ||
      storedImage.productId !== expected.id ||
      storedImage.contentType !== image.contentType ||
      storedImage.sizeBytes !== image.body.length ||
      storedImage.altText !== expected.title ||
      storedImage.sortOrder !== 0 ||
      storedImage.deletedAt !== null ||
      storedImage.uploadedAt?.toISOString() !== DEMO_DATE.toISOString()
    )
      fail();
    if (
      expected.productType === 'ACCOUNT' &&
      (!product.accountDetails ||
        !product.sourceListingDraft.accountDetails ||
        product.accountDetails.provenance !== 'ORIGINAL_OWNER' ||
        product.accountDetails.recoveryLevel !== 'FULL' ||
        product.accountDetails.emailVerified !== true ||
        product.accountDetails.phoneLinked !== false ||
        product.accountDetails.documentLinked !== false ||
        product.accountDetails.fullAccess !== true ||
        product.accountDetails.recoveryRisk !== 'LOW' ||
        product.accountDetails.warrantyNote !==
          'Informação exclusivamente demonstrativa; nenhuma credencial real incluída.' ||
        product.sourceListingDraft.accountDetails.provenance !== 'ORIGINAL_OWNER' ||
        product.sourceListingDraft.accountDetails.recoveryLevel !== 'FULL' ||
        product.sourceListingDraft.accountDetails.recoveryRisk !== 'LOW')
    )
      fail();
    if (
      expected.service &&
      (product.serviceDetails?.pricingType !== expected.service ||
        product.sourceListingDraft.serviceDetails?.pricingType !== expected.service ||
        Number(product.serviceDetails.basePrice) !==
          Number(expected.service === 'FIXED' ? 79.9 : null) ||
        product.serviceDetails.estimatedDelivery !== 'Até 2 dias úteis' ||
        product.serviceDetails.buyerRequirements !==
          'Descreva apenas o objetivo fictício da demonstração.' ||
        product.serviceDetails.notes !== null ||
        Number(product.sourceListingDraft.serviceDetails.basePrice) !==
          Number(expected.service === 'FIXED' ? 79.9 : null) ||
        product.sourceListingDraft.serviceDetails.estimatedDelivery !== 'Até 2 dias úteis' ||
        product.sourceListingDraft.serviceDetails.buyerRequirements !==
          'Descreva apenas o objetivo fictício da demonstração.' ||
        product.sourceListingDraft.serviceDetails.notes !== null)
    )
      fail();
  }
  const storageAdapter = {
    createReadUrl: async (key: string) => ({
      readUrl: await getSignedUrl(
        signingS3,
        new GetObjectCommand({ Bucket: config.bucket, Key: key }),
        { expiresIn: config.readUrlTtlSeconds },
      ),
      expiresAt: new Date(Date.now() + config.readUrlTtlSeconds * 1000),
    }),
    createUploadUrl: () => Promise.reject(new Error('unused')),
    headObject: () => Promise.resolve(null),
    deleteObject: () => Promise.resolve(undefined),
  };
  const catalog = new PublicProductCatalogService(prisma as never, storageAdapter);
  const lists = await Promise.all(
    Object.values(PublicCatalogSort).map((sort) => catalog.list({ page: 1, limit: 24, sort })),
  );
  const expectedPublic = DEMO_PRODUCTS.filter((product) => product.status === 'ACTIVE');
  if (
    lists.some(
      (list) =>
        list.items.length !== 6 ||
        list.items.some((item) => !expectedPublic.some((expected) => expected.slug === item.slug)),
    )
  )
    fail();
  const byRecent = [...expectedPublic].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime() || b.id.localeCompare(a.id),
  );
  const byOldest = [...expectedPublic].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime() || a.id.localeCompare(b.id),
  );
  const byTitle = [...expectedPublic].sort(
    (a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id),
  );
  const expectedOrders = [byRecent, byOldest, byTitle, [...byTitle].reverse()].map((items) =>
    items.map((item) => item.slug),
  );
  if (
    lists.some(
      (list, index) => list.items.map((item) => item.slug).join() !== expectedOrders[index].join(),
    )
  )
    fail();
  const paged = await catalog.list({ page: 1, limit: 2, sort: PublicCatalogSort.RECENT });
  if (paged.items.length !== 2 || !paged.pagination.hasNext) fail();
  const detail = await catalog.detail(expectedPublic[0].slug);
  if (!detail.coverImage.url || JSON.stringify({ lists, detail }).includes('objectKey')) fail();
  for (const hidden of DEMO_PRODUCTS.filter((product) => product.status !== 'ACTIVE')) {
    try {
      await catalog.detail(hidden.slug);
      fail();
    } catch (error) {
      if ((error as { code?: string }).code !== 'PRODUCT_NOT_FOUND') fail();
    }
  }
  for (const image of DEMO_IMAGES) {
    const head = await internalS3.send(
      new HeadObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
    );
    const object = await internalS3.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
    );
    const bytes = await objectBytes(object.Body);
    if (
      head.ContentLength !== image.body.length ||
      head.ContentType !== image.contentType ||
      createHash('sha256').update(bytes).digest('hex') !== image.sha256
    )
      fail();
    const downloadUrl = await getSignedUrl(
      internalS3,
      new GetObjectCommand({ Bucket: config.bucket, Key: image.objectKey }),
      { expiresIn: config.readUrlTtlSeconds },
    );
    const download = await fetch(downloadUrl);
    if (!download.ok || !Buffer.from(await download.arrayBuffer()).equals(image.body)) fail();
    const anonymous = await fetch(`${config.s3Endpoint}/${config.bucket}/${image.objectKey}`);
    if (anonymous.ok) fail();
  }
  return { ok: true, action: 'verify', ...DEMO_SUMMARY };
}

async function reset(context: Runtime) {
  const { prisma, config, internalS3 } = context;
  await assertNoNamespaceConflicts(context);
  await assertNoStorageConflicts(context);
  await prisma.$transaction(async (tx) => {
    const userIds = DEMO_USERS.map((x) => x.id),
      productIds = DEMO_PRODUCTS.map((x) => x.id),
      draftIds = DEMO_PRODUCTS.map((x) => x.draftId);
    const externalCartReference = await tx.cart.findFirst({
      where: {
        buyerUserId: { notIn: userIds },
        OR: [
          { sellerProfileId: DEMO_IDS.sellerProfile },
          { items: { some: { productId: { in: productIds } } } },
        ],
      },
      select: { id: true },
    });
    if (externalCartReference) throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    const externalOrderReference = await tx.order.findFirst({
      where: {
        buyerUserId: { notIn: userIds },
        OR: [
          { sellerProfileId: DEMO_IDS.sellerProfile },
          { items: { some: { sourceProductId: { in: productIds } } } },
          { reservations: { some: { productId: { in: productIds } } } },
        ],
      },
      select: { id: true },
    });
    if (externalOrderReference) throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    const demoOrderIds = (
      await tx.order.findMany({ where: { buyerUserId: { in: userIds } }, select: { id: true } })
    ).map(({ id }) => id);
    const demoOrderEventIds = (
      await tx.orderEvent.findMany({
        where: { orderId: { in: demoOrderIds } },
        select: { id: true },
      })
    ).map(({ id }) => id);
    await tx.outboxEvent.deleteMany({ where: { orderEventId: { in: demoOrderEventIds } } });
    await tx.orderEvent.deleteMany({ where: { id: { in: demoOrderEventIds } } });
    await tx.commerceIdempotencyRecord.deleteMany({ where: { actorUserId: { in: userIds } } });
    await tx.inventoryReservation.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await tx.orderItem.deleteMany({ where: { orderId: { in: demoOrderIds } } });
    await tx.order.deleteMany({ where: { id: { in: demoOrderIds } } });
    // Cart ownership, rather than a global truncate, keeps non-demo buyers untouched.
    await tx.cartItem.deleteMany({ where: { cart: { buyerUserId: { in: userIds } } } });
    await tx.cart.deleteMany({ where: { buyerUserId: { in: userIds } } });
    await tx.productImage.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productServiceDetails.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productAccountDetails.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productAttributeValue.deleteMany({ where: { productId: { in: productIds } } });
    await tx.productVariant.deleteMany({ where: { productId: { in: productIds } } });
    await tx.product.deleteMany({ where: { id: { in: productIds } } });
    await tx.listingDraftServiceDetails.deleteMany({ where: { draftId: { in: draftIds } } });
    await tx.listingDraftAccountDetails.deleteMany({ where: { draftId: { in: draftIds } } });
    await tx.listingDraftAttributeValue.deleteMany({ where: { draftId: { in: draftIds } } });
    await tx.listingDraftVariant.deleteMany({ where: { draftId: { in: draftIds } } });
    await tx.listingDraft.deleteMany({ where: { id: { in: draftIds } } });
    await tx.catalogSubcategory.deleteMany({
      where: { id: { in: DEMO_CATEGORIES.flatMap((x) => x.subcategories.map((s) => s.id)) } },
    });
    await tx.catalogCategory.deleteMany({
      where: { id: { in: DEMO_CATEGORIES.map((x) => x.id) } },
    });
    await tx.sellerProfile.deleteMany({ where: { id: DEMO_IDS.sellerProfile } });
    await tx.sellerApplication.deleteMany({ where: { id: DEMO_IDS.sellerApplication } });
    const sessions = await tx.session.findMany({
      where: { userId: { in: userIds } },
      select: { id: true, deviceId: true },
    });
    const sessionIds = sessions.map((x) => x.id),
      deviceIds = sessions.map((x) => x.deviceId);
    await tx.stepUpGrant.deleteMany({ where: { userId: { in: userIds } } });
    await tx.sessionRefreshToken.deleteMany({ where: { sessionId: { in: sessionIds } } });
    await tx.session.deleteMany({ where: { id: { in: sessionIds } } });
    await tx.verificationChallenge.deleteMany({ where: { userId: { in: userIds } } });
    await tx.emailChangeRequest.deleteMany({ where: { userId: { in: userIds } } });
    await tx.twoFactorRecoveryCode.deleteMany({ where: { userId: { in: userIds } } });
    await tx.twoFactorSettings.deleteMany({ where: { userId: { in: userIds } } });
    await tx.device.deleteMany({
      where: { OR: [{ userId: { in: userIds } }, { id: { in: deviceIds } }] },
    });
    await tx.userRoleAssignment.deleteMany({ where: { userId: { in: userIds } } });
    await tx.passwordCredential.deleteMany({ where: { userId: { in: userIds } } });
    await tx.user.deleteMany({ where: { id: { in: userIds } } });
  });
  await Promise.all(
    DEMO_IMAGES.map((image) =>
      internalS3.send(new DeleteObjectCommand({ Bucket: config.bucket, Key: image.objectKey })),
    ),
  );
  return {
    ok: true,
    action: 'reset',
    removedProducts: DEMO_SUMMARY.products,
    removedImages: DEMO_SUMMARY.images,
  };
}

export async function runDemoCommand(argv: string[], env: NodeJS.ProcessEnv) {
  const command = parseDemoCommand(argv);
  const context = runtime(assertDemoEnvironment(env));
  try {
    return command === 'seed'
      ? await seed(context)
      : command === 'verify'
        ? await verify(context)
        : await reset(context);
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002')
      throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
    throw error;
  } finally {
    await context.prisma.$disconnect();
    context.internalS3.destroy();
    context.signingS3.destroy();
  }
}

if (require.main === module)
  runDemoCommand(process.argv.slice(2), process.env)
    .then((summary) => console.log(JSON.stringify(summary)))
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          ok: false,
          code: error instanceof DemoDataError ? error.code : 'DEMO_DATA_FAILED',
        }),
      );
      process.exitCode = 1;
    });
