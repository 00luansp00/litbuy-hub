import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Prisma,
  ProductStatus,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { ProductLifecycleDto, ProductLifecycleAction } from './dto';
import { assertPublicationEligible, lifecycleTarget } from './product-publication.rules';

const lifecycleInclude = {
  sellerProfile: true,
  sourceListingDraft: true,
  category: true,
  subcategory: true,
  images: { select: { status: true, isCover: true } },
  variants: true,
  serviceDetails: true,
} as const;
type Tx = Prisma.TransactionClient;

@Injectable()
export class ProductLifecycleService {
  constructor(private readonly prisma: PrismaService) {}

  async transition(userId: string, productId: string, dto: ProductLifecycleDto) {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`WITH lifecycle_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${'product-lifecycle:' + productId}))) SELECT 1::integer AS "acquired" FROM lifecycle_lock`;
      const seller = await tx.sellerProfile.findUnique({ where: { userId } });
      if (!seller || seller.status !== SellerProfileStatus.ACTIVE)
        throw new AppError(
          'SELLER_PROFILE_ACTIVE_REQUIRED',
          'SELLER_PROFILE_ACTIVE_REQUIRED',
          HttpStatus.FORBIDDEN,
          [],
        );
      const product = await tx.product.findFirst({
        where: { id: productId, sellerProfileId: seller.id },
        include: lifecycleInclude,
      });
      if (!product)
        throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', HttpStatus.NOT_FOUND, []);
      const target = lifecycleTarget(product.status, dto.action);
      if (!target.changed) return this.response(product, false);
      if (product.version !== dto.expectedVersion)
        throw new AppError(
          'PRODUCT_VERSION_CONFLICT',
          'PRODUCT_VERSION_CONFLICT',
          HttpStatus.CONFLICT,
          [{ currentVersion: product.version, currentStatus: product.status }],
        );
      if (target.status === ProductStatus.ACTIVE) assertPublicationEligible(product);
      const updated = await tx.product.updateMany({
        where: { id: product.id, version: dto.expectedVersion, status: product.status },
        data: { status: target.status, version: { increment: 1 } },
      });
      if (updated.count !== 1)
        throw new AppError(
          'PRODUCT_VERSION_CONFLICT',
          'PRODUCT_VERSION_CONFLICT',
          HttpStatus.CONFLICT,
          [],
        );
      const next = await tx.product.findUniqueOrThrow({ where: { id: product.id } });
      await this.audit(tx, userId, product, next.status, dto.action);
      return this.response(next, true);
    });
  }

  private response(
    product: { id: string; slug: string; status: ProductStatus; version: number; updatedAt: Date },
    changed: boolean,
  ) {
    return {
      id: product.id,
      slug: product.slug,
      status: product.status,
      version: product.version,
      updatedAt: product.updatedAt.toISOString(),
      changed,
    };
  }

  private async audit(
    tx: Tx,
    userId: string,
    previous: { id: string; sellerProfileId: string; status: ProductStatus; version: number },
    nextStatus: ProductStatus,
    action: ProductLifecycleAction,
  ) {
    const types = {
      ACTIVATE: SecurityEventType.PRODUCT_ACTIVATED,
      PAUSE: SecurityEventType.PRODUCT_PAUSED,
      RESUME: SecurityEventType.PRODUCT_RESUMED,
      REMOVE: SecurityEventType.PRODUCT_REMOVED,
    } as const;
    await tx.securityEvent.create({
      data: {
        userId,
        eventType: types[action],
        outcome: SecurityEventOutcome.SUCCESS,
        metadata: {
          productId: previous.id,
          sellerProfileId: previous.sellerProfileId,
          actorUserId: userId,
          previousStatus: previous.status,
          nextStatus,
          previousVersion: previous.version,
          nextVersion: previous.version + 1,
          action,
        },
      },
    });
  }
}
