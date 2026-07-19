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
