import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import {
  CatalogAttributeInputType,
  CatalogEntityStatus,
  CatalogProductType,
  Prisma,
} from '@prisma/client';
import { CatalogService } from './catalog.service';

const cat = {
  id: '00000000-0000-4000-8000-000000000001',
  slug: 'contas',
  name: 'Contas',
  description: null,
  iconKey: 'Gift',
  colorHex: '#8B5CF6',
  featured: false,
  sortOrder: 1,
  status: CatalogEntityStatus.ACTIVE,
};
const inactiveCat = {
  ...cat,
  id: '00000000-0000-4000-8000-000000000002',
  slug: 'old',
  status: CatalogEntityStatus.INACTIVE,
};
const sub = {
  id: '00000000-0000-4000-8000-000000000101',
  categoryId: cat.id,
  slug: 'valorant',
  name: 'Valorant',
  sortOrder: 1,
  status: CatalogEntityStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const genericAttr = {
  id: '00000000-0000-4000-8000-000000001001',
  subcategoryId: null,
  productType: CatalogProductType.ACCOUNT,
  key: 'servidor',
  label: 'Servidor genérico',
  inputType: CatalogAttributeInputType.TEXT,
  placeholder: null,
  required: false,
  selectOptions: [],
  sortOrder: 2,
  status: CatalogEntityStatus.ACTIVE,
  createdAt: new Date(),
  updatedAt: new Date(),
};
const specificAttr = {
  ...genericAttr,
  id: '00000000-0000-4000-8000-000000001002',
  subcategoryId: sub.id,
  productType: null,
  label: 'Servidor',
  inputType: CatalogAttributeInputType.SELECT,
  selectOptions: ['BR', 'NA'],
  sortOrder: 1,
};

function prismaMock() {
  const audit = jest.fn().mockResolvedValue({});
  const tx = {
    catalogCategory: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    catalogSubcategory: {
      create: jest.fn(),
      update: jest.fn(),
      findUnique: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    catalogAttribute: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      findMany: jest.fn(),
    },
    securityEvent: { create: audit },
  };
  return {
    tx,
    prisma: { ...tx, $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)) },
  };
}

describe('CatalogService', () => {
  it('lists only active public categories and hides inactive category by slug', async () => {
    const { prisma } = prismaMock();
    prisma.catalogCategory.findMany.mockResolvedValue([cat]);
    prisma.catalogCategory.findFirst.mockResolvedValueOnce(null);
    const service = new CatalogService(prisma as never);
    await expect(service.publicCategories()).resolves.toEqual({
      items: [expect.objectContaining({ slug: 'contas' })],
    });
    await expect(service.publicCategoryBySlug(inactiveCat.slug)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('lists active subcategories and resolves attributes with override and ordering', async () => {
    const { prisma } = prismaMock();
    prisma.catalogCategory.findFirst.mockResolvedValue(cat);
    prisma.catalogSubcategory.findMany.mockResolvedValue([sub]);
    prisma.catalogSubcategory.findFirst.mockResolvedValue(sub);
    prisma.catalogAttribute.findMany
      .mockResolvedValueOnce([genericAttr])
      .mockResolvedValueOnce([specificAttr]);
    const service = new CatalogService(prisma as never);
    await expect(service.publicSubcategories('contas')).resolves.toEqual({
      items: [{ id: sub.id, slug: sub.slug, name: sub.name, sortOrder: sub.sortOrder }],
    });
    await expect(
      service.attributes({
        categorySlug: 'contas',
        subcategorySlug: 'valorant',
        productType: 'account',
      }),
    ).resolves.toEqual({
      items: [
        expect.objectContaining({ key: 'servidor', inputType: 'select', options: ['BR', 'NA'] }),
      ],
    });
  });

  it('creates, updates, rejects empty patch, skips idempotent audit and records audit on change', async () => {
    const { prisma, tx } = prismaMock();
    tx.catalogCategory.create.mockResolvedValue(cat);
    tx.catalogCategory.findUniqueOrThrow.mockResolvedValue(cat);
    tx.catalogCategory.update.mockResolvedValue({ ...cat, name: 'Contas VIP' });
    const service = new CatalogService(prisma as never);
    await expect(
      service.createCategory({ slug: 'contas-vip', name: 'Contas VIP' }, 'admin'),
    ).resolves.toMatchObject({ slug: 'contas' });
    await expect(service.updateCategory(cat.id, {}, 'admin')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    await expect(service.updateCategory(cat.id, { name: 'Contas' }, 'admin')).resolves.toEqual(cat);
    expect(tx.securityEvent.create).toHaveBeenCalledTimes(1);
    await expect(
      service.updateCategory(cat.id, { name: 'Contas VIP' }, 'admin'),
    ).resolves.toMatchObject({ name: 'Contas VIP' });
    expect(tx.securityEvent.create).toHaveBeenCalledTimes(2);
  });

  it('maps Prisma P2002, P2003 and P2025 safely', () => {
    const service = new CatalogService(prismaMock().prisma as never);
    expect(() =>
      service.mapPrismaError(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2002', clientVersion: 'test' }),
        'category',
      ),
    ).toThrow(ConflictException);
    expect(() =>
      service.mapPrismaError(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2003', clientVersion: 'test' }),
        'subcategory',
      ),
    ).toThrow(NotFoundException);
    expect(() =>
      service.mapPrismaError(
        new Prisma.PrismaClientKnownRequestError('x', { code: 'P2025', clientVersion: 'test' }),
        'attribute',
      ),
    ).toThrow(NotFoundException);
  });

  it('validates attribute scope, partial SELECT options and scope switches', async () => {
    const { prisma, tx } = prismaMock();
    tx.catalogSubcategory.findUnique.mockResolvedValue(sub);
    tx.catalogAttribute.findUniqueOrThrow.mockResolvedValue(specificAttr);
    tx.catalogAttribute.update.mockImplementation(({ data }) =>
      Promise.resolve({ ...specificAttr, ...data }),
    );
    const service = new CatalogService(prisma as never);
    await expect(
      service.createAttribute(
        { key: 'elo', label: 'Elo', inputType: 'select', selectOptions: ['Ferro'] },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.createAttribute(
        {
          subcategoryId: sub.id,
          productType: 'account',
          key: 'elo',
          label: 'Elo',
          inputType: 'select',
          selectOptions: ['Ferro'],
        },
        'admin',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAttribute(specificAttr.id, { selectOptions: ['BR', 'NA'] }, 'admin'),
    ).resolves.toMatchObject({ options: ['BR', 'NA'] });
    await expect(
      service.updateAttribute(
        specificAttr.id,
        { subcategoryId: null, productType: 'virtual_currency' },
        'admin',
      ),
    ).resolves.toMatchObject({ productType: 'virtual_currency' });
    await expect(
      service.updateAttribute(specificAttr.id, { inputType: 'text' }, 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.updateAttribute(specificAttr.id, { inputType: 'select', selectOptions: [] }, 'admin'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rolls back when audit fails because mutation and audit share transaction callback', async () => {
    const { prisma, tx } = prismaMock();
    tx.catalogCategory.create.mockResolvedValue(cat);
    tx.securityEvent.create.mockRejectedValue(new Error('audit failed'));
    const service = new CatalogService(prisma as never);
    await expect(
      service.createCategory({ slug: 'rollback', name: 'Rollback' }, 'admin'),
    ).rejects.toThrow('audit failed');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});
