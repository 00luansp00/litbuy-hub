import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';
import { hashPassword } from '../auth/auth.utils';
import {
  DEMO_CATEGORIES,
  DEMO_DATE,
  DEMO_IDS,
  DEMO_PNG,
  DEMO_PRODUCTS,
  DEMO_SUMMARY,
  DEMO_USERS,
} from './demo-data.fixtures';
import { assertDemoEnvironment, DemoDataError, parseDemoCommand } from './demo-data.guard';

const prisma = new PrismaClient();
const bucket = () => process.env.PRODUCT_IMAGE_S3_BUCKET!;
const storage = () =>
  new S3Client({
    endpoint: process.env.PRODUCT_IMAGE_S3_ENDPOINT,
    region: process.env.PRODUCT_IMAGE_S3_REGION ?? 'us-east-1',
    forcePathStyle: process.env.PRODUCT_IMAGE_S3_FORCE_PATH_STYLE !== 'false',
    credentials: {
      accessKeyId: process.env.PRODUCT_IMAGE_S3_ACCESS_KEY!,
      secretAccessKey: process.env.PRODUCT_IMAGE_S3_SECRET_KEY!,
    },
  });

export async function assertNoNamespaceConflicts() {
  for (const user of DEMO_USERS) {
    const found = await prisma.user.findUnique({
      where: { email: user.email },
      select: { id: true },
    });
    if (found && found.id !== user.id) throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  }
  for (const category of DEMO_CATEGORIES) {
    const found = await prisma.catalogCategory.findUnique({
      where: { slug: category.slug },
      select: { id: true },
    });
    if (found && found.id !== category.id) throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  }
  for (const product of DEMO_PRODUCTS) {
    const [slug, key] = await Promise.all([
      prisma.product.findUnique({ where: { slug: product.slug }, select: { id: true } }),
      prisma.productImage.findUnique({
        where: { objectKey: product.objectKey },
        select: { id: true },
      }),
    ]);
    if ((slug && slug.id !== product.id) || (key && key.id !== product.imageId))
      throw new DemoDataError('DEMO_DATA_NAMESPACE_CONFLICT');
  }
}

async function uploadImages() {
  const client = storage();
  await Promise.all(
    DEMO_PRODUCTS.map((product) =>
      client.send(
        new PutObjectCommand({
          Bucket: bucket(),
          Key: product.objectKey,
          Body: DEMO_PNG,
          ContentType: 'image/png',
        }),
      ),
    ),
  );
}

export async function seed() {
  await assertNoNamespaceConflicts();
  await uploadImages();
  const passwordHash = await hashPassword(process.env.DEMO_USER_PASSWORD!);
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
          termsVersion: process.env.CURRENT_TERMS_VERSION!,
          termsAcceptedAt: DEMO_DATE,
          privacyVersion: process.env.CURRENT_PRIVACY_VERSION!,
          privacyAcceptedAt: DEMO_DATE,
          createdAt: DEMO_DATE,
        },
        update: {
          email: user.email,
          status: 'ACTIVE',
          emailVerifiedAt: DEMO_DATE,
          deletedAt: null,
          termsVersion: process.env.CURRENT_TERMS_VERSION!,
          privacyVersion: process.env.CURRENT_PRIVACY_VERSION!,
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
        update: { passwordHash, failedLoginAttempts: 0, lockedUntil: null },
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
        sellerAgreementVersion: process.env.CURRENT_SELLER_AGREEMENT_VERSION!,
        sellerAgreementAcceptedAt: DEMO_DATE,
        submittedAt: DEMO_DATE,
        reviewedAt: DEMO_DATE,
        reviewedByUserId: DEMO_IDS.users.admin,
        createdAt: DEMO_DATE,
      },
      update: {
        storeName: 'LIT Demo Store',
        requestedSlug: 'demo-lit-store',
        status: 'APPROVED',
        reviewedByUserId: DEMO_IDS.users.admin,
        rejectionCode: null,
        rejectionReason: null,
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
        storeName: 'LIT Demo Store',
        slug: 'demo-lit-store',
        description: 'Loja fictícia para demonstração local.',
        status: 'ACTIVE',
        verified: true,
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
        },
        update: {
          slug: category.slug,
          name: category.name,
          description: 'Taxonomia fictícia de demonstração.',
          sortOrder: category.sortOrder,
          status: 'ACTIVE',
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
          submittedAt: DEMO_DATE,
          reviewedAt: DEMO_DATE,
          approvedAt: DEMO_DATE,
          reviewedByUserId: DEMO_IDS.users.admin,
          createdAt: DEMO_DATE,
        },
        update: {
          categoryId: item.categoryId,
          subcategoryId: item.subcategoryId,
          productType: item.productType,
          model: item.model,
          status: 'APPROVED',
          title: item.title,
          description: item.description,
          price: item.price,
          stock: item.stock,
          approvedAt: DEMO_DATE,
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
          createdAt: DEMO_DATE,
        },
        update: {
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
        },
      });
      await tx.listingDraftVariant.deleteMany({ where: { draftId: item.draftId } });
      await tx.productVariant.deleteMany({ where: { productId: item.id } });
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
      await tx.productImage.upsert({
        where: { id: item.imageId },
        create: {
          id: item.imageId,
          productId: item.id,
          objectKey: item.objectKey,
          status: 'READY',
          contentType: 'image/png',
          sizeBytes: DEMO_PNG.length,
          altText: item.title,
          sortOrder: 0,
          isCover: true,
          uploadedAt: DEMO_DATE,
          uploadExpiresAt: new Date('2099-01-01'),
          createdAt: DEMO_DATE,
        },
        update: {
          productId: item.id,
          objectKey: item.objectKey,
          status: 'READY',
          contentType: 'image/png',
          sizeBytes: DEMO_PNG.length,
          altText: item.title,
          sortOrder: 0,
          isCover: true,
          uploadedAt: DEMO_DATE,
          uploadExpiresAt: new Date('2099-01-01'),
          deletedAt: null,
        },
      });
    }
  });
  await verify();
  return { ok: true, action: 'seed', ...DEMO_SUMMARY };
}

export async function verify() {
  const client = storage();
  const [users, sellers, categories, subcategories, products, publicProducts, images] =
    await Promise.all([
      prisma.user.findMany({
        where: { id: { in: DEMO_USERS.map((x) => x.id) } },
        include: { passwordCredential: true, roleAssignments: true },
      }),
      prisma.sellerProfile.count({
        where: { id: DEMO_IDS.sellerProfile, status: 'ACTIVE', verified: true },
      }),
      prisma.catalogCategory.count({
        where: { id: { in: DEMO_CATEGORIES.map((x) => x.id) }, status: 'ACTIVE' },
      }),
      prisma.catalogSubcategory.count({
        where: {
          id: { in: DEMO_CATEGORIES.flatMap((x) => x.subcategories.map((s) => s.id)) },
          status: 'ACTIVE',
        },
      }),
      prisma.product.count({ where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } } }),
      prisma.product.count({
        where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) }, status: 'ACTIVE' },
      }),
      prisma.productImage.count({
        where: { id: { in: DEMO_PRODUCTS.map((x) => x.imageId) }, status: 'READY', isCover: true },
      }),
    ]);
  const counts = {
    users: users.length,
    sellers,
    categories,
    subcategories,
    products,
    publicProducts,
    images,
  };
  if (JSON.stringify(counts) !== JSON.stringify(DEMO_SUMMARY))
    throw new DemoDataError('DEMO_DATA_VERIFICATION_FAILED');
  for (const expected of DEMO_USERS) {
    const user = users.find((x) => x.id === expected.id);
    if (
      !user?.passwordCredential ||
      !(await argon2.verify(
        user.passwordCredential.passwordHash,
        process.env.DEMO_USER_PASSWORD!,
      )) ||
      user.status !== 'ACTIVE' ||
      !user.emailVerifiedAt ||
      user.roleAssignments
        .map((x) => x.role)
        .sort()
        .join() !== [...expected.roles].sort().join()
    )
      throw new DemoDataError('DEMO_DATA_VERIFICATION_FAILED');
  }
  for (const item of DEMO_PRODUCTS) {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: bucket(), Key: item.objectKey }),
    );
    if (!head.ContentLength || head.ContentType !== 'image/png')
      throw new DemoDataError('DEMO_DATA_VERIFICATION_FAILED');
  }
  return { ok: true, action: 'verify', ...DEMO_SUMMARY };
}

export async function reset() {
  await prisma.$transaction(async (tx) => {
    const productIds = DEMO_PRODUCTS.map((x) => x.id),
      draftIds = DEMO_PRODUCTS.map((x) => x.draftId);
    await tx.productImage.deleteMany({
      where: { id: { in: DEMO_PRODUCTS.map((x) => x.imageId) } },
    });
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
    await tx.userRoleAssignment.deleteMany({
      where: { userId: { in: DEMO_USERS.map((x) => x.id) } },
    });
    await tx.passwordCredential.deleteMany({
      where: { userId: { in: DEMO_USERS.map((x) => x.id) } },
    });
    await tx.user.deleteMany({ where: { id: { in: DEMO_USERS.map((x) => x.id) } } });
  });
  const client = storage();
  await Promise.all(
    DEMO_PRODUCTS.map((item) =>
      client.send(new DeleteObjectCommand({ Bucket: bucket(), Key: item.objectKey })),
    ),
  );
  return {
    ok: true,
    action: 'reset',
    removedProducts: DEMO_SUMMARY.products,
    removedImages: DEMO_SUMMARY.images,
  };
}

export async function run(argv = process.argv.slice(2), env = process.env) {
  const command = parseDemoCommand(argv);
  assertDemoEnvironment(env);
  return command === 'seed' ? seed() : command === 'verify' ? verify() : reset();
}

if (require.main === module)
  run()
    .then((summary) => console.log(JSON.stringify(summary)))
    .catch((error: unknown) => {
      console.error(
        JSON.stringify({
          ok: false,
          code: error instanceof DemoDataError ? error.code : 'DEMO_DATA_FAILED',
        }),
      );
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
