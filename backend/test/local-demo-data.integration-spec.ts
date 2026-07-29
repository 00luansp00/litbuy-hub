import { PrismaClient } from '@prisma/client';
import {
  DEMO_CATEGORIES,
  DEMO_IDS,
  DEMO_IMAGES,
  DEMO_PRODUCTS,
  DEMO_SUMMARY,
  DEMO_USERS,
} from '../src/cli/demo-data.fixtures';
import { runDemoCommand } from '../src/cli/demo-data';

const prisma = new PrismaClient();
const env = process.env;

describe('local demo data with real PostgreSQL and MinIO', () => {
  jest.setTimeout(180_000);
  beforeAll(async () => void (await runDemoCommand(['reset', '--confirm'], env)));
  afterAll(async () => {
    await runDemoCommand(['reset', '--confirm'], env);
    await prisma.$disconnect();
  });

  it('seeds, verifies and remains deterministic on a second seed', async () => {
    expect(await runDemoCommand(['seed'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    const before = await prisma.product.findMany({
      where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } },
      orderBy: { updatedAt: 'asc' },
      select: { id: true, updatedAt: true },
    });
    expect(await runDemoCommand(['seed'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await prisma.user.count({ where: { id: { in: DEMO_USERS.map((x) => x.id) } } })).toBe(3);
    expect(
      await prisma.product.count({ where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } } }),
    ).toBe(8);
    expect(
      await prisma.productImage.count({
        where: { objectKey: { in: DEMO_IMAGES.map((x) => x.objectKey) } },
      }),
    ).toBe(8);
    expect(
      await prisma.product.findMany({
        where: { id: { in: DEMO_PRODUCTS.map((x) => x.id) } },
        orderBy: { updatedAt: 'asc' },
        select: { id: true, updatedAt: true },
      }),
    ).toEqual(before);
  });

  it('restores relational drift and removes unexpected demo children', async () => {
    await prisma.catalogCategory.update({
      where: { id: DEMO_CATEGORIES[0].id },
      data: { name: 'drift' },
    });
    await prisma.product.update({
      where: { id: DEMO_PRODUCTS[0].id },
      data: { title: 'drift', status: 'PAUSED' },
    });
    await prisma.sellerProfile.update({
      where: { id: DEMO_IDS.sellerProfile },
      data: { description: 'drift' },
    });
    await prisma.productVariant.create({
      data: { productId: DEMO_PRODUCTS[0].id, title: 'extra', price: 1, stock: 1 },
    });
    await prisma.productAccountDetails.update({
      where: { productId: DEMO_PRODUCTS[0].id },
      data: { warrantyNote: 'drift' },
    });
    await runDemoCommand(['seed'], env);
    expect(await runDemoCommand(['verify'], env)).toMatchObject(DEMO_SUMMARY);
    expect(await prisma.productVariant.count({ where: { productId: DEMO_PRODUCTS[0].id } })).toBe(
      1,
    );
  });

  it('preserves external sentinels and resets repeatedly', async () => {
    const sentinel = await prisma.catalogCategory.create({
      data: { slug: 'integration-sentinel', name: 'Sentinel' },
    });
    const eventsBefore = await prisma.securityEvent.count();
    expect(await runDemoCommand(['reset', '--confirm'], env)).toMatchObject({
      ok: true,
      action: 'reset',
    });
    expect(await prisma.catalogCategory.findUnique({ where: { id: sentinel.id } })).not.toBeNull();
    expect(await prisma.securityEvent.count()).toBe(eventsBefore);
    expect(await runDemoCommand(['reset', '--confirm'], env)).toMatchObject({
      ok: true,
      action: 'reset',
    });
    await prisma.catalogCategory.delete({ where: { id: sentinel.id } });
  });
});
