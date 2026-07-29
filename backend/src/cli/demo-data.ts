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
  const [application, profile] = await Promise.all([
    prisma.sellerApplication.findUnique({ where: { id: DEMO_IDS.sellerApplication } }),
    prisma.sellerProfile.findUnique({ where: { id: DEMO_IDS.sellerProfile } }),
  ]);
  if (
    (application && application.userId !== DEMO_IDS.users.seller) ||
    (profile && (profile.userId !== DEMO_IDS.users.seller || profile.slug !== 'demo-lit-store'))
  )
    throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  for (const product of DEMO_PRODUCTS) {
    const [slug, key, byId, draft, imageById] = await Promise.all([
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
          birthDate: new Date('1995-01-01'),
          status: 'ACTIVE',
          emailVerifiedAt: DEMO_DATE,
          termsVersion: config.termsVersion,
          termsAcceptedAt: DEMO_DATE,
          privacyVersion: config.privacyVersion,
          privacyAcceptedAt: DEMO_DATE,
          createdAt: DEMO_DATE,
        },
        update: {
          email: user.email,
          birthDate: new Date('1995-01-01'),
          status: 'ACTIVE',
          emailVerifiedAt: DEMO_DATE,
          deletedAt: null,
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
        createdAt: DEMO_DATE,
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
          sortOrder: category.sortOrder,
          status: 'ACTIVE',
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
        update: {
          slug: category.slug,
          name: category.name,
          description: 'Taxonomia fictícia de demonstração.',
          sortOrder: category.sortOrder,
          status: 'ACTIVE',
          createdAt: DEMO_DATE,
          updatedAt: DEMO_DATE,
        },
      });
      for (const sub of category.subcategories)
        await tx.catalogSubcategory.upsert({
          where: { id: sub.id },
          create: { ...sub, categoryId: category.id, status: 'ACTIVE', createdAt: DEMO_DATE },
          update: {
            slug: sub.slug,
            name: sub.name,
            categoryId: category.id,
            sortOrder: sub.sortOrder,
            status: 'ACTIVE',
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
          submittedAt: item.createdAt,
          reviewedAt: item.createdAt,
          approvedAt: item.createdAt,
          reviewedByUserId: DEMO_IDS.users.admin,
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
          submittedAt: item.createdAt,
          reviewedAt: item.createdAt,
          reviewedByUserId: DEMO_IDS.users.admin,
          approvedAt: item.createdAt,
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
          },
        });
        await tx.productServiceDetails.create({
          data: {
            productId: item.id,
            pricingType: item.service,
            basePrice,
            estimatedDelivery: 'Até 2 dias úteis',
            buyerRequirements: 'Descreva apenas o objetivo fictício da demonstração.',
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
      !user.emailVerifiedAt ||
      user.deletedAt ||
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
    application.reviewedByUserId !== DEMO_IDS.users.admin ||
    !application.sellerAgreementAcceptedAt ||
    !seller ||
    seller.userId !== DEMO_IDS.users.seller ||
    seller.slug !== 'demo-lit-store' ||
    seller.status !== 'ACTIVE' ||
    !seller.verified ||
    categories.length !== 3 ||
    categories.flatMap((x) => x.subcategories).length !== 8 ||
    products.length !== 8
  )
    fail();
  for (const expected of DEMO_PRODUCTS) {
    const product = products.find((candidate) => candidate.id === expected.id);
    if (!product) {
      fail();
      continue;
    }
    if (
      product.slug !== expected.slug ||
      product.status !== expected.status ||
      product.title !== expected.title ||
      product.sourceListingDraft.status !== 'APPROVED' ||
      product.sourceListingDraft.sellerProfileId !== DEMO_IDS.sellerProfile ||
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
    if (
      expected.productType === 'ACCOUNT' &&
      (!product.accountDetails ||
        !product.sourceListingDraft.accountDetails ||
        product.accountDetails.recoveryRisk !== 'LOW')
    )
      fail();
    if (
      expected.service &&
      (product.serviceDetails?.pricingType !== expected.service ||
        product.sourceListingDraft.serviceDetails?.pricingType !== expected.service)
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
