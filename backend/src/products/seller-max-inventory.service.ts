import { HttpStatus, Injectable } from '@nestjs/common';
import {
  CommerceIdempotencyOperation,
  ListingDraftModel,
  ListingDraftSellerPlanPreference,
  Prisma,
  ProductPauseReason,
  ProductStatus,
  ProductVariantStatus,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { canonicalRequestHash, type ParsedIdempotencyKey } from '../commerce/idempotency-key';
import { acquireAdvisoryTransactionLock } from '../database/advisory-lock';
import { PrismaService } from '../database/prisma.service';
import { SellerMaxRestockDto } from './dto';
import { publicationEligibilityCode } from './product-publication.rules';

const include = {
  sellerProfile: true,
  sourceListingDraft: true,
  category: true,
  subcategory: true,
  images: { select: { status: true, isCover: true } },
  variants: true,
  serviceDetails: true,
} as const;

@Injectable()
export class SellerMaxInventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async restock(
    userId: string,
    productId: string,
    key: ParsedIdempotencyKey,
    dto: SellerMaxRestockDto,
  ) {
    const requestHash = canonicalRequestHash({ productId, ...dto });
    return this.prisma.$transaction(async (tx) => {
      await acquireAdvisoryTransactionLock(
        tx,
        `idempotency:${userId}:SELLER_MAX_RESTOCK:${key.hash}`,
      );
      const prior = await tx.commerceIdempotencyRecord.findUnique({
        where: {
          actorUserId_operation_keyHash: {
            actorUserId: userId,
            operation: CommerceIdempotencyOperation.SELLER_MAX_RESTOCK,
            keyHash: key.hash,
          },
        },
      });
      if (prior) {
        if (prior.requestHash !== requestHash) this.fail('IDEMPOTENCY_KEY_REUSED', 409);
        if (prior.completedAt && prior.responseBody) return prior.responseBody;
      }

      await acquireAdvisoryTransactionLock(tx, `product-lifecycle:${productId}`);
      const seller = await tx.sellerProfile.findUnique({ where: { userId } });
      if (!seller || seller.status !== SellerProfileStatus.ACTIVE)
        this.fail('SELLER_PROFILE_ACTIVE_REQUIRED', HttpStatus.FORBIDDEN);
      const product = await tx.product.findFirst({
        where: { id: productId, sellerProfileId: seller.id },
        include,
      });
      if (!product) this.fail('PRODUCT_NOT_FOUND', HttpStatus.NOT_FOUND);
      if (product.sellerPlan !== ListingDraftSellerPlanPreference.LIT_MAX)
        this.fail('SELLER_MAX_PRODUCT_REQUIRED', 422);
      if (product.status === ProductStatus.REMOVED) this.fail('PRODUCT_REMOVED_TERMINAL', 409);
      if (product.version !== dto.expectedVersion)
        throw new AppError('PRODUCT_VERSION_CONFLICT', 'PRODUCT_VERSION_CONFLICT', 409, [
          { currentVersion: product.version, currentStatus: product.status },
        ]);
      if (product.model === ListingDraftModel.SERVICE)
        this.fail('PRODUCT_STOCK_NOT_CONTROLLED', 422);

      let stockBefore: number;
      let stockAfter: number;
      let variantId: string | null = null;
      if (product.model === ListingDraftModel.NORMAL) {
        if (dto.variantId || product.stock === null) this.fail('PRODUCT_STOCK_NOT_CONTROLLED', 422);
        await acquireAdvisoryTransactionLock(tx, `checkout-stock:product:${product.id}`);
        stockBefore = product.stock;
        stockAfter = stockBefore + dto.quantityToAdd;
        await tx.product.update({ where: { id: product.id }, data: { stock: stockAfter } });
        product.stock = stockAfter;
      } else {
        if (!dto.variantId) this.fail('PRODUCT_VARIANT_REQUIRED', 422);
        const variant = product.variants.find((candidate) => candidate.id === dto.variantId);
        if (!variant) this.fail('PRODUCT_VARIANT_NOT_FOUND', 404);
        if (variant.stock === null) this.fail('PRODUCT_STOCK_NOT_CONTROLLED', 422);
        variantId = variant.id;
        await acquireAdvisoryTransactionLock(tx, `checkout-stock:variant:${variant.id}`);
        const locked = await tx.productVariant.findUniqueOrThrow({ where: { id: variant.id } });
        if (locked.stock === null) this.fail('PRODUCT_STOCK_NOT_CONTROLLED', 422);
        stockBefore = locked.stock;
        stockAfter = stockBefore + dto.quantityToAdd;
        await tx.productVariant.update({ where: { id: variant.id }, data: { stock: stockAfter } });
        const local = product.variants.find((candidate) => candidate.id === variant.id)!;
        local.stock = stockAfter;
      }

      const previousStatus = product.status;
      const previousVersion = product.version;
      const hadAutoPause = product.pauseReason === ProductPauseReason.SELLER_MAX_OUT_OF_STOCK;
      let nextStatus = previousStatus;
      let autoResumed = false;
      let publicationBlocker: string | null = null;
      let hasPersistedSellableStock = false;
      if (hadAutoPause) {
        hasPersistedSellableStock =
          product.model === ListingDraftModel.NORMAL
            ? stockAfter > 0
            : product.variants.some(
                (variant) =>
                  variant.status === ProductVariantStatus.ACTIVE &&
                  variant.stock !== null &&
                  variant.stock > 0,
              );
        if (hasPersistedSellableStock) {
          publicationBlocker = publicationEligibilityCode(product);
          if (!publicationBlocker) {
            nextStatus = ProductStatus.ACTIVE;
            autoResumed = true;
          }
        }
      }
      const nextVersion = previousVersion + 1;
      await tx.product.update({
        where: { id: product.id },
        data: {
          status: nextStatus,
          pauseReason: hadAutoPause && hasPersistedSellableStock ? null : product.pauseReason,
          version: nextVersion,
        },
      });
      const baseMetadata: Prisma.InputJsonObject = {
        productId: product.id,
        sellerProfileId: seller.id,
        variantId,
        quantity: dto.quantityToAdd,
        stockBefore,
        stockAfter,
        previousStatus,
        nextStatus,
        previousVersion,
        nextVersion,
        reason: 'SELLER_MAX_RESTOCK',
      };
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.PRODUCT_INVENTORY_RESTOCKED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { ...baseMetadata, actorType: 'SELLER', actorUserId: userId },
        },
      });
      if (autoResumed)
        await tx.securityEvent.create({
          data: {
            userId: null,
            eventType: SecurityEventType.PRODUCT_AUTO_RESUMED_AFTER_RESTOCK,
            outcome: SecurityEventOutcome.SUCCESS,
            metadata: { ...baseMetadata, actorType: 'SYSTEM' },
          },
        });
      const response = {
        productId: product.id,
        variantId,
        quantityAdded: dto.quantityToAdd,
        stockBefore,
        stockAfter,
        status: nextStatus,
        version: nextVersion,
        autoResumed,
        publicationBlocker,
      };
      await tx.commerceIdempotencyRecord.create({
        data: {
          actorUserId: userId,
          operation: CommerceIdempotencyOperation.SELLER_MAX_RESTOCK,
          keyHash: key.hash,
          requestHash,
          responseStatus: 201,
          responseBody: response,
          resourceType: 'PRODUCT',
          resourceId: product.id,
          completedAt: new Date(),
          expiresAt: new Date(Date.now() + 86_400_000),
        },
      });
      return response;
    });
  }

  private fail(code: string, status: number): never {
    throw new AppError(code, code, status, []);
  }
}
