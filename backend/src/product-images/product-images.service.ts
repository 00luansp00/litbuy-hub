import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  ProductImage,
  ProductImageStatus,
  ProductStatus,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { PRODUCT_IMAGE_LIMIT, nextCover, objectKeyFor, validateImage } from './product-image.rules';
import { PRODUCT_IMAGE_STORAGE, ProductImageStorage } from './product-image.storage';

type Tx = Prisma.TransactionClient;
@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_IMAGE_STORAGE) private readonly storage: ProductImageStorage,
  ) {}
  private async acquireTransactionLock(tx: Tx, key: string): Promise<void> {
    await tx.$queryRaw<
      { acquired: number }[]
    >`WITH advisory_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${key}))) SELECT 1::integer AS "acquired" FROM advisory_lock`;
  }
  private async owner(db: PrismaService | Tx, userId: string, productId: string, mutation = false) {
    const product = await db.product.findFirst({
      where: { id: productId, sellerProfile: { userId, status: SellerProfileStatus.ACTIVE } },
      include: { sellerProfile: true },
    });
    if (!product)
      throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', HttpStatus.NOT_FOUND, []);
    if (mutation && product.status !== ProductStatus.UNPUBLISHED)
      throw new AppError(
        'PRODUCT_IMAGE_STATUS_INCOMPATIBLE',
        'PRODUCT_IMAGE_STATUS_INCOMPATIBLE',
        409,
        [],
      );
    return product;
  }
  private base(image: ProductImage) {
    return {
      id: image.id,
      status: image.status,
      contentType: image.contentType,
      sizeBytes: image.sizeBytes,
      altText: image.altText,
      sortOrder: image.sortOrder,
      isCover: image.isCover,
      uploadedAt: image.uploadedAt?.toISOString() ?? null,
      createdAt: image.createdAt.toISOString(),
    };
  }
  private async map(image: ProductImage) {
    if (image.status !== ProductImageStatus.READY)
      return { ...this.base(image), viewUrl: null, viewExpiresAt: null };
    const view = await this.storage.createReadUrl(image.objectKey);
    return {
      ...this.base(image),
      viewUrl: view.readUrl,
      viewExpiresAt: view.expiresAt.toISOString(),
    };
  }
  private async expire(tx: Tx, productId: string, now: Date) {
    await tx.productImage.updateMany({
      where: {
        productId,
        status: ProductImageStatus.PENDING_UPLOAD,
        uploadExpiresAt: { lte: now },
      },
      data: { status: ProductImageStatus.DELETED, deletedAt: now },
    });
  }
  async createIntent(
    userId: string,
    productId: string,
    input: { contentType: string; sizeBytes: number; altText?: string },
  ) {
    validateImage(input.contentType, input.sizeBytes);
    await this.owner(this.prisma, userId, productId, true);
    const id = randomUUID();
    const objectKey = objectKeyFor(productId, id, input.contentType);
    const signed = await this.storage.createUploadUrl({
      key: objectKey,
      contentType: input.contentType,
    });
    await this.prisma.$transaction(async (tx) => {
      await this.acquireTransactionLock(tx, `product-images:${productId}`);
      const product = await this.owner(tx, userId, productId, true);
      const now = new Date();
      await this.expire(tx, productId, now);
      const count = await tx.productImage.count({
        where: {
          productId,
          status: { in: [ProductImageStatus.PENDING_UPLOAD, ProductImageStatus.READY] },
        },
      });
      if (count >= PRODUCT_IMAGE_LIMIT)
        throw new AppError('PRODUCT_IMAGE_LIMIT_REACHED', 'PRODUCT_IMAGE_LIMIT_REACHED', 409, []);
      const maximum = await tx.productImage.aggregate({
        where: { productId, status: { not: ProductImageStatus.DELETED } },
        _max: { sortOrder: true },
      });
      const image = await tx.productImage.create({
        data: {
          id,
          productId,
          objectKey,
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          altText: input.altText?.trim() || null,
          sortOrder: (maximum._max.sortOrder ?? -1) + 1,
          uploadExpiresAt: signed.expiresAt,
        },
      });
      await this.audit(
        tx,
        userId,
        SecurityEventType.PRODUCT_IMAGE_UPLOAD_INTENT_CREATED,
        product.sellerProfileId,
        image,
        SecurityEventOutcome.PENDING,
      );
    });
    return {
      imageId: id,
      uploadUrl: signed.uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': input.contentType },
      expiresAt: signed.expiresAt.toISOString(),
    };
  }
  async complete(userId: string, productId: string, imageId: string) {
    await this.owner(this.prisma, userId, productId, true);
    const initial = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!initial || initial.status === ProductImageStatus.DELETED)
      throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
    if (initial.status === ProductImageStatus.READY) return this.map(initial);
    const metadata = await this.storage.headObject(initial.objectKey);
    const valid =
      metadata?.sizeBytes === initial.sizeBytes && metadata.contentType === initial.contentType;
    const result = await this.prisma.$transaction(async (tx) => {
      await this.acquireTransactionLock(tx, `product-images:${productId}`);
      const product = await this.owner(tx, userId, productId, true);
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!image || image.status === ProductImageStatus.DELETED)
        throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
      if (image.status === ProductImageStatus.READY) return image;
      const now = new Date();
      if (image.uploadExpiresAt <= now || !valid) {
        const deleted = await tx.productImage.update({
          where: { id: imageId },
          data: { status: ProductImageStatus.DELETED, deletedAt: now },
        });
        await this.audit(
          tx,
          userId,
          SecurityEventType.PRODUCT_IMAGE_UPLOAD_REJECTED,
          product.sellerProfileId,
          deleted,
          SecurityEventOutcome.BLOCKED,
        );
        return null;
      }
      const hasCover = await tx.productImage.count({
        where: { productId, status: ProductImageStatus.READY, isCover: true },
      });
      const ready = await tx.productImage.update({
        where: { id: imageId },
        data: { status: ProductImageStatus.READY, uploadedAt: now, isCover: hasCover === 0 },
      });
      await this.audit(
        tx,
        userId,
        SecurityEventType.PRODUCT_IMAGE_UPLOAD_COMPLETED,
        product.sellerProfileId,
        ready,
        SecurityEventOutcome.SUCCESS,
      );
      return ready;
    });
    if (!result) {
      if (metadata) await this.storage.deleteObject(initial.objectKey).catch(() => undefined);
      throw new AppError('PRODUCT_IMAGE_UPLOAD_INVALID', 'PRODUCT_IMAGE_UPLOAD_INVALID', 422, []);
    }
    return this.map(result);
  }
  async listSeller(userId: string, productId: string) {
    await this.owner(this.prisma, userId, productId);
    return this.list(productId);
  }
  async listAdmin(productId: string) {
    if (!(await this.prisma.product.count({ where: { id: productId } })))
      throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', 404, []);
    return this.list(productId);
  }
  private async list(productId: string) {
    const images = await this.prisma.productImage.findMany({
      where: { productId, status: { not: ProductImageStatus.DELETED } },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    });
    return {
      items: await Promise.all(images.map((image) => this.map(image))),
      limit: PRODUCT_IMAGE_LIMIT,
    };
  }
  async cover(userId: string, productId: string, imageId: string) {
    const image = await this.prisma.$transaction(async (tx) => {
      await this.acquireTransactionLock(tx, `product-images:${productId}`);
      const product = await this.owner(tx, userId, productId, true);
      const found = await tx.productImage.findFirst({
        where: { id: imageId, productId, status: ProductImageStatus.READY },
      });
      if (!found) throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
      await tx.productImage.updateMany({
        where: { productId, isCover: true },
        data: { isCover: false },
      });
      const updated = await tx.productImage.update({
        where: { id: imageId },
        data: { isCover: true },
      });
      await this.audit(
        tx,
        userId,
        SecurityEventType.PRODUCT_IMAGE_COVER_CHANGED,
        product.sellerProfileId,
        updated,
        SecurityEventOutcome.SUCCESS,
      );
      return updated;
    });
    return this.map(image);
  }
  async reorder(userId: string, productId: string, ids: string[]) {
    if (new Set(ids).size !== ids.length)
      throw new AppError('PRODUCT_IMAGE_ORDER_INVALID', 'PRODUCT_IMAGE_ORDER_INVALID', 400, []);
    await this.prisma.$transaction(async (tx) => {
      await this.acquireTransactionLock(tx, `product-images:${productId}`);
      const product = await this.owner(tx, userId, productId, true);
      const current = await tx.productImage.findMany({
        where: { productId, status: { not: ProductImageStatus.DELETED } },
        select: { id: true },
      });
      if (
        current.length !== ids.length ||
        ids.some((id) => !current.some((item) => item.id === id))
      )
        throw new AppError('PRODUCT_IMAGE_ORDER_INVALID', 'PRODUCT_IMAGE_ORDER_INVALID', 400, []);
      for (const [sortOrder, id] of ids.entries())
        await tx.productImage.update({ where: { id }, data: { sortOrder } });
      await tx.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.PRODUCT_IMAGES_REORDERED,
          outcome: SecurityEventOutcome.SUCCESS,
          metadata: { productId, sellerProfileId: product.sellerProfileId, imageIds: ids },
        },
      });
    });
    return this.list(productId);
  }
  async remove(userId: string, productId: string, imageId: string) {
    const objectKey = await this.prisma.$transaction(async (tx) => {
      await this.acquireTransactionLock(tx, `product-images:${productId}`);
      const product = await this.owner(tx, userId, productId, true);
      const image = await tx.productImage.findFirst({ where: { id: imageId, productId } });
      if (!image) throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
      if (image.status !== ProductImageStatus.DELETED) {
        await tx.productImage.update({
          where: { id: imageId },
          data: { status: ProductImageStatus.DELETED, deletedAt: new Date(), isCover: false },
        });
        if (image.isCover) {
          const candidates = await tx.productImage.findMany({
            where: { productId, status: ProductImageStatus.READY, id: { not: imageId } },
            select: { id: true, sortOrder: true },
          });
          const promoted = nextCover(candidates);
          if (promoted)
            await tx.productImage.update({ where: { id: promoted.id }, data: { isCover: true } });
        }
        await this.audit(
          tx,
          userId,
          SecurityEventType.PRODUCT_IMAGE_DELETED,
          product.sellerProfileId,
          image,
          SecurityEventOutcome.SUCCESS,
        );
      }
      return image.objectKey;
    });
    try {
      await this.storage.deleteObject(objectKey);
    } catch {
      throw new AppError('PRODUCT_IMAGE_CLEANUP_PENDING', 'PRODUCT_IMAGE_CLEANUP_PENDING', 503, []);
    }
    return { deleted: true };
  }
  private audit(
    tx: Tx,
    userId: string,
    eventType: SecurityEventType,
    sellerProfileId: string,
    image: Pick<ProductImage, 'id' | 'productId' | 'objectKey' | 'sizeBytes' | 'contentType'>,
    outcome: SecurityEventOutcome,
  ) {
    return tx.securityEvent.create({
      data: {
        userId,
        eventType,
        outcome,
        metadata: {
          productId: image.productId,
          imageId: image.id,
          sellerProfileId,
          objectKey: image.objectKey,
          sizeBytes: image.sizeBytes,
          contentType: image.contentType,
        },
      },
    });
  }
}
