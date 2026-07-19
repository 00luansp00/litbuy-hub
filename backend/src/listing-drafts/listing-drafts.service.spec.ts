import { HttpStatus } from '@nestjs/common';
import { CatalogProductType, ListingDraftModel, Prisma } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import type { PrismaService } from '../database/prisma.service';
import { ListingDraftsService } from './listing-drafts.service';

type ConsistencySnapshot = {
  model?: ListingDraftModel | null;
  productType?: CatalogProductType | null;
  price?: Prisma.Decimal | null;
  stock?: number | null;
  variants?: unknown[];
  serviceDetails?: object | null;
  accountDetails?: object | null;
};

type ListingDraftsServiceProbe = {
  productType(value: string | null | undefined): CatalogProductType | null | undefined;
  assertModelConsistency(snapshot: ConsistencySnapshot): void;
};

const makeProbe = () =>
  new ListingDraftsService({} as PrismaService) as unknown as ListingDraftsServiceProbe;

const expectAppError = (fn: () => void, code: string, status = HttpStatus.CONFLICT) => {
  expect(fn).toThrow(AppError);
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(AppError);
    const appError = error as AppError;
    expect(appError.code).toBe(code);
    expect(appError.statusCode).toBe(status);
  }
};

describe('ListingDraftsService', () => {
  describe('productType normalization', () => {
    it('preserves an omitted productType as undefined', () => {
      expect(makeProbe().productType(undefined)).toBeUndefined();
    });

    it('clears an explicit productType null', () => {
      expect(makeProbe().productType(null)).toBeNull();
    });

    it('normalizes API product type strings into Prisma enum values', () => {
      expect(makeProbe().productType('account')).toBe(CatalogProductType.ACCOUNT);
      expect(makeProbe().productType('virtual_currency')).toBe(CatalogProductType.VIRTUAL_CURRENCY);
    });
  });

  describe('model consistency', () => {
    it('allows NORMAL without variants or service details', () => {
      expect(() =>
        makeProbe().assertModelConsistency({ model: ListingDraftModel.NORMAL }),
      ).not.toThrow();
    });

    it('rejects NORMAL variants', () => {
      expectAppError(
        () =>
          makeProbe().assertModelConsistency({ model: ListingDraftModel.NORMAL, variants: [{}] }),
        'LISTING_VARIANTS_NOT_ALLOWED',
      );
    });

    it('rejects NORMAL service details', () => {
      expectAppError(
        () =>
          makeProbe().assertModelConsistency({
            model: ListingDraftModel.NORMAL,
            serviceDetails: {},
          }),
        'LISTING_SERVICE_DETAILS_NOT_ALLOWED',
      );
    });

    it('rejects DYNAMIC main price, stock and service details as model data conflicts', () => {
      for (const snapshot of [
        { price: new Prisma.Decimal('10.00') },
        { stock: 1 },
        { serviceDetails: {} },
      ]) {
        expectAppError(
          () =>
            makeProbe().assertModelConsistency({ model: ListingDraftModel.DYNAMIC, ...snapshot }),
          'LISTING_MODEL_DATA_CONFLICT',
        );
      }
    });

    it('rejects SERVICE main price, stock, variants and account details', () => {
      for (const snapshot of [
        { price: new Prisma.Decimal('10.00') },
        { stock: 1 },
        { variants: [{}] },
        { accountDetails: {} },
      ]) {
        expectAppError(
          () =>
            makeProbe().assertModelConsistency({ model: ListingDraftModel.SERVICE, ...snapshot }),
          snapshot.accountDetails
            ? 'LISTING_ACCOUNT_DETAILS_NOT_ALLOWED'
            : 'LISTING_MODEL_DATA_CONFLICT',
        );
      }
    });

    it('accepts account details only with product type ACCOUNT', () => {
      expect(() =>
        makeProbe().assertModelConsistency({
          model: ListingDraftModel.NORMAL,
          productType: CatalogProductType.ACCOUNT,
          accountDetails: {},
        }),
      ).not.toThrow();
      expectAppError(
        () =>
          makeProbe().assertModelConsistency({
            model: ListingDraftModel.NORMAL,
            productType: CatalogProductType.SERVICE,
            accountDetails: {},
          }),
        'LISTING_ACCOUNT_DETAILS_NOT_ALLOWED',
      );
    });
  });
});

type FakeDraft = {
  id: string;
  sellerProfileId: string;
  categoryId: string | null;
  subcategoryId: string | null;
  productType: CatalogProductType | null;
  model: ListingDraftModel;
  status: 'DRAFT';
  title: string | null;
  description: string | null;
  price: Prisma.Decimal | null;
  stock: number | null;
  deliveryMode: 'MANUAL';
  requestedPromotionTier: 'SILVER';
  requestedSellerPlan: 'STANDARD';
  autoMessage: string | null;
  notifyInApp: boolean;
  notifyBrowser: boolean;
  notifyEmailFuture: boolean;
  notifyExternalFuture: boolean;
  wizardStep: number;
  version: number;
  submittedAt: Date | null;
  reviewStartedAt: Date | null;
  reviewedAt: Date | null;
  reviewedByUserId: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
  approvedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  category: null;
  subcategory: null;
  variants: [];
  attributes: [];
  serviceDetails: null;
  accountDetails: null;
  sellerProfile: {
    id: string;
    userId: string;
    storeName: string;
    slug: string;
    status: 'ACTIVE' | 'SUSPENDED';
    verified: boolean;
  };
  reviewedBy: null;
};

type FakeStore = {
  sellerProfile: FakeDraft['sellerProfile'] | null;
  drafts: FakeDraft[];
  securityEvents: { userId: string | null; eventType: string; metadata: unknown }[];
  failAudit?: boolean;
  calls: string[];
};

const makeDraft = (userId: string, data: Partial<FakeDraft> = {}): FakeDraft => {
  const now = new Date('2026-07-19T12:00:00.000Z');
  const sellerProfile = data.sellerProfile ?? {
    id: '00000000-0000-4000-8000-000000000100',
    userId,
    storeName: 'Store',
    slug: 'store',
    status: 'ACTIVE',
    verified: false,
  };
  return {
    id: data.id ?? '00000000-0000-4000-8000-000000000200',
    sellerProfileId: sellerProfile.id,
    categoryId: null,
    subcategoryId: null,
    productType: null,
    model: ListingDraftModel.NORMAL,
    status: 'DRAFT',
    title: null,
    description: null,
    price: null,
    stock: null,
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
    submittedAt: null,
    reviewStartedAt: null,
    reviewedAt: null,
    reviewedByUserId: null,
    rejectionCode: null,
    rejectionReason: null,
    approvedAt: null,
    createdAt: now,
    updatedAt: now,
    category: null,
    subcategory: null,
    variants: [],
    attributes: [],
    serviceDetails: null,
    accountDetails: null,
    sellerProfile,
    reviewedBy: null,
    ...data,
  };
};

const makeTransactionalPrisma = (store: FakeStore): PrismaService => {
  const transaction = async <T>(
    callback: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> => {
    const draftSnapshot = [...store.drafts];
    const eventSnapshot = [...store.securityEvents];
    const tx = {
      sellerProfile: {
        findUnique: jest.fn(() => store.sellerProfile),
      },
      catalogCategory: { findUnique: jest.fn() },
      catalogSubcategory: { findUnique: jest.fn() },
      catalogAttribute: { findMany: jest.fn(() => []) },
      listingDraft: {
        create: jest.fn(({ data }: { data: Partial<FakeDraft> }) => {
          store.calls.push('draft.create');
          const draft = makeDraft(store.sellerProfile?.userId ?? 'missing-user', {
            ...data,
            sellerProfile: store.sellerProfile ?? undefined,
            sellerProfileId: store.sellerProfile?.id ?? 'missing-profile',
          });
          store.drafts.push(draft);
          return draft;
        }),
        findUnique: jest.fn(({ where }: { where: { id: string } }) =>
          store.drafts.find((draft) => draft.id === where.id),
        ),
      },
      listingDraftVariant: { deleteMany: jest.fn(), createMany: jest.fn() },
      listingDraftServiceDetails: { create: jest.fn(), deleteMany: jest.fn() },
      listingDraftAccountDetails: { create: jest.fn(), deleteMany: jest.fn() },
      securityEvent: {
        create: jest.fn(
          ({ data }: { data: { userId: string | null; eventType: string; metadata: unknown } }) => {
            store.calls.push('securityEvent.create');
            if (store.failAudit) throw new Error('audit failed');
            store.securityEvents.push(data);
            return data;
          },
        ),
      },
    } as unknown as Prisma.TransactionClient;
    try {
      return await callback(tx);
    } catch (error) {
      store.drafts = draftSnapshot;
      store.securityEvents = eventSnapshot;
      throw error;
    }
  };
  return { $transaction: transaction } as unknown as PrismaService;
};

describe('ListingDraftsService public methods', () => {
  const userId = '00000000-0000-4000-8000-000000000001';

  it('create persists a partial draft, audits in the same transaction and returns a seller contract without e-mail or reviewer', async () => {
    const store: FakeStore = {
      sellerProfile: makeDraft(userId).sellerProfile,
      drafts: [],
      securityEvents: [],
      calls: [],
    };
    const result = await new ListingDraftsService(makeTransactionalPrisma(store)).create(userId, {
      title: ' Rascunho <b>Seguro</b> ',
      wizardStep: 2,
    });

    expect(result).toMatchObject({ status: 'DRAFT', title: 'Rascunho Seguro', version: 1 });
    expect(JSON.stringify(result)).not.toContain('userEmail');
    expect(JSON.stringify(result)).not.toContain('reviewedBy');
    expect(store.drafts).toHaveLength(1);
    expect(store.securityEvents).toHaveLength(1);
    expect(store.securityEvents[0]?.eventType).toBe('LISTING_DRAFT_CREATED');
    expect(store.calls).toEqual(['draft.create', 'securityEvent.create']);
  });

  it('create blocks a seller without an active profile', async () => {
    const store: FakeStore = { sellerProfile: null, drafts: [], securityEvents: [], calls: [] };
    await expect(
      new ListingDraftsService(makeTransactionalPrisma(store)).create(userId, {}),
    ).rejects.toMatchObject({
      code: 'SELLER_PROFILE_ACTIVE_REQUIRED',
      statusCode: HttpStatus.FORBIDDEN,
    });
  });

  it('create rolls back the draft when same-transaction audit fails', async () => {
    const store: FakeStore = {
      sellerProfile: makeDraft(userId).sellerProfile,
      drafts: [],
      securityEvents: [],
      calls: [],
      failAudit: true,
    };
    await expect(
      new ListingDraftsService(makeTransactionalPrisma(store)).create(userId, {}),
    ).rejects.toThrow('audit failed');
    expect(store.drafts).toHaveLength(0);
    expect(store.securityEvents).toHaveLength(0);
  });
});
