import {
  CatalogEntityStatus,
  ListingDraftModel,
  ListingDraftStatus,
  ProductImageStatus,
  ProductStatus,
  ProductVariantStatus,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { ProductLifecycleAction } from './dto';
import { ProductLifecycleService } from './product-lifecycle.service';

const userId = '00000000-0000-4000-8000-000000000001';
const sellerId = '00000000-0000-4000-8000-000000000002';
const productId = '00000000-0000-4000-8000-000000000003';
const product = (status: ProductStatus = ProductStatus.UNPUBLISHED) => ({
  id: productId,
  sourceListingDraftId: '00000000-0000-4000-8000-000000000004',
  sellerProfileId: sellerId,
  categoryId: '00000000-0000-4000-8000-000000000005',
  subcategoryId: null,
  productType: 'ACCOUNT' as const,
  model: ListingDraftModel.NORMAL,
  status,
  slug: 'produto-real',
  title: 'Produto real',
  description: 'Descrição real',
  price: '10',
  stock: 0,
  version: 1,
  updatedAt: new Date('2026-07-28T12:00:00.000Z'),
  sellerProfile: { id: sellerId, status: SellerProfileStatus.ACTIVE },
  sourceListingDraft: {
    status: ListingDraftStatus.APPROVED,
    categoryId: '00000000-0000-4000-8000-000000000005',
    subcategoryId: null,
    productType: 'ACCOUNT' as const,
  },
  category: { status: CatalogEntityStatus.ACTIVE },
  subcategory: null,
  images: [{ status: ProductImageStatus.READY, isCover: true }],
  variants: [{ status: ProductVariantStatus.ACTIVE, price: '10', stock: 0 }],
  serviceDetails: null,
});

function harness(current = product()) {
  let persisted: ReturnType<typeof product> = { ...current };
  const order: string[] = [];
  const tx = {
    $queryRaw: jest.fn(() => {
      order.push('lock');
      return Promise.resolve([{ acquired: 1 }]);
    }),
    sellerProfile: {
      findUnique: jest.fn(() => {
        order.push('seller');
        return { id: sellerId, status: SellerProfileStatus.ACTIVE };
      }),
    },
    product: {
      findFirst: jest.fn(() => {
        order.push('product');
        return persisted;
      }),
      updateMany: jest.fn(({ data }: { data: { status: ProductStatus } }) => {
        order.push('update');
        persisted = {
          ...persisted,
          status: data.status,
          version: persisted.version + 1,
          updatedAt: new Date('2026-07-28T12:01:00.000Z'),
        };
        return { count: 1 };
      }),
      findUniqueOrThrow: jest.fn(() => persisted),
    },
    securityEvent: {
      create: jest.fn(
        (args: { data: { eventType: SecurityEventType; metadata: Record<string, unknown> } }) => {
          void args;
          order.push('audit');
          return {};
        },
      ),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) => callback(tx)),
  };
  return {
    service: new ProductLifecycleService(prisma as never),
    prisma,
    tx,
    order,
    persisted: () => persisted,
  };
}
const expectCode = async (promise: Promise<unknown>, code: string) => {
  await expect(promise).rejects.toMatchObject({ code });
};

describe('ProductLifecycleService', () => {
  it.each([null, { id: sellerId, status: SellerProfileStatus.SUSPENDED }])(
    'rejects missing or suspended seller %p',
    async (seller) => {
      const h = harness();
      h.tx.sellerProfile.findUnique.mockResolvedValueOnce(seller as never);
      await expectCode(
        h.service.transition(userId, productId, {
          action: ProductLifecycleAction.ACTIVATE,
          expectedVersion: 1,
        }),
        'SELLER_PROFILE_ACTIVE_REQUIRED',
      );
      expect(h.tx.product.findFirst).not.toHaveBeenCalled();
    },
  );
  it('returns the same safe not-found response for missing and foreign products', async () => {
    for (const missing of [null, undefined]) {
      const h = harness();
      h.tx.product.findFirst.mockResolvedValueOnce(missing as never);
      await expectCode(
        h.service.transition(userId, productId, {
          action: ProductLifecycleAction.ACTIVATE,
          expectedVersion: 1,
        }),
        'PRODUCT_NOT_FOUND',
      );
      expect(h.tx.product.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: productId, sellerProfileId: sellerId } }),
      );
    }
  });
  it.each([
    [
      ProductStatus.UNPUBLISHED,
      ProductLifecycleAction.ACTIVATE,
      ProductStatus.ACTIVE,
      SecurityEventType.PRODUCT_ACTIVATED,
    ],
    [
      ProductStatus.ACTIVE,
      ProductLifecycleAction.PAUSE,
      ProductStatus.PAUSED,
      SecurityEventType.PRODUCT_PAUSED,
    ],
    [
      ProductStatus.PAUSED,
      ProductLifecycleAction.RESUME,
      ProductStatus.ACTIVE,
      SecurityEventType.PRODUCT_RESUMED,
    ],
    [
      ProductStatus.ACTIVE,
      ProductLifecycleAction.REMOVE,
      ProductStatus.REMOVED,
      SecurityEventType.PRODUCT_REMOVED,
    ],
  ])('persists and audits %s + %s exactly once', async (from, action, to, eventType) => {
    const h = harness(product(from));
    await expect(
      h.service.transition(userId, productId, { action, expectedVersion: 1 }),
    ).resolves.toMatchObject({ status: to, version: 2, changed: true });
    expect(h.tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(h.tx.securityEvent.create).toHaveBeenCalledTimes(1);
    const data = h.tx.securityEvent.create.mock.calls[0]?.[0];
    expect(data).toBeDefined();
    expect(data.data).toMatchObject({
      eventType,
      metadata: { productId, actorUserId: userId, previousVersion: 1, nextVersion: 2 },
    });
    expect(JSON.stringify(data.data.metadata)).not.toMatch(
      /objectKey|token|cookie|header|url|description/i,
    );
  });
  it('checks version and conditional update conflicts', async () => {
    const stale = harness();
    await expectCode(
      stale.service.transition(userId, productId, {
        action: ProductLifecycleAction.ACTIVATE,
        expectedVersion: 2,
      }),
      'PRODUCT_VERSION_CONFLICT',
    );
    expect(stale.tx.product.updateMany).not.toHaveBeenCalled();
    const raced = harness();
    raced.tx.product.updateMany.mockReturnValueOnce({ count: 0 });
    await expectCode(
      raced.service.transition(userId, productId, {
        action: ProductLifecycleAction.ACTIVATE,
        expectedVersion: 1,
      }),
      'PRODUCT_VERSION_CONFLICT',
    );
    expect(raced.tx.securityEvent.create).not.toHaveBeenCalled();
  });
  it.each([
    [ProductStatus.ACTIVE, ProductLifecycleAction.ACTIVATE],
    [ProductStatus.PAUSED, ProductLifecycleAction.PAUSE],
    [ProductStatus.REMOVED, ProductLifecycleAction.REMOVE],
  ])('makes %s + %s retry read-only', async (status, action) => {
    const h = harness(product(status));
    await expect(
      h.service.transition(userId, productId, { action, expectedVersion: 999 }),
    ).resolves.toMatchObject({ changed: false, version: 1 });
    expect(h.tx.product.updateMany).not.toHaveBeenCalled();
    expect(h.tx.securityEvent.create).not.toHaveBeenCalled();
  });
  it('acquires the advisory lock before every transactional read', async () => {
    const h = harness();
    await h.service.transition(userId, productId, {
      action: ProductLifecycleAction.ACTIVATE,
      expectedVersion: 1,
    });
    expect(h.order.slice(0, 3)).toEqual(['lock', 'seller', 'product']);
  });
  it('rolls back when audit fails after update', async () => {
    const h = harness();
    h.tx.securityEvent.create.mockImplementationOnce(() =>
      Promise.reject(new Error('audit failed')),
    );
    await expect(
      h.service.transition(userId, productId, {
        action: ProductLifecycleAction.ACTIVATE,
        expectedVersion: 1,
      }),
    ).rejects.toThrow('audit failed');
    expect(h.tx.product.updateMany).toHaveBeenCalledTimes(1);
    expect(h.prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
