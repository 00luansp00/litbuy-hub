import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import {
  Prisma,
  ProductImageStatus,
  SecurityEventOutcome,
  SecurityEventType,
  SellerProfileStatus,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { PRODUCT_IMAGE_LIMIT, nextCover, objectKeyFor, validateImage } from './product-image.rules';
import { PRODUCT_IMAGE_STORAGE, ProductImageStorage } from './product-image.storage';

@Injectable()
export class ProductImagesService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(PRODUCT_IMAGE_STORAGE) private readonly storage: ProductImageStorage,
  ) {}
  private map(image: {
    id: string;
    status: ProductImageStatus;
    contentType: string;
    sizeBytes: number;
    altText: string | null;
    sortOrder: number;
    isCover: boolean;
    uploadedAt: Date | null;
    createdAt: Date;
  }) {
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
  private async owner(userId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, sellerProfile: { userId, status: SellerProfileStatus.ACTIVE } },
      include: { sellerProfile: true },
    });
    if (!product)
      throw new AppError('PRODUCT_NOT_FOUND', 'PRODUCT_NOT_FOUND', HttpStatus.NOT_FOUND, []);
    return product;
  }
  async createIntent(
    userId: string,
    productId: string,
    input: { contentType: string; sizeBytes: number; altText?: string },
  ) {
    validateImage(input.contentType, input.sizeBytes);
    const product = await this.owner(userId, productId);
    const image = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product-images:${productId}`}, 0))`;
      const count = await tx.productImage.count({
        where: {
          productId,
          status: { in: [ProductImageStatus.PENDING_UPLOAD, ProductImageStatus.READY] },
        },
      });
      if (count >= PRODUCT_IMAGE_LIMIT)
        throw new AppError('PRODUCT_IMAGE_LIMIT_REACHED', 'PRODUCT_IMAGE_LIMIT_REACHED', 409, []);
      const id = randomUUID();
      const created = await tx.productImage.create({
        data: {
          id,
          productId,
          objectKey: objectKeyFor(productId, id, input.contentType),
          contentType: input.contentType,
          sizeBytes: input.sizeBytes,
          altText: input.altText?.trim() || null,
          sortOrder: count,
        },
      });
      await this.audit(
        tx,
        userId,
        SecurityEventType.PRODUCT_IMAGE_UPLOAD_INTENT_CREATED,
        product.sellerProfileId,
        created,
        SecurityEventOutcome.PENDING,
      );
      return created;
    });
    const signed = await this.storage.createUploadUrl({
      key: image.objectKey,
      contentType: image.contentType,
    });
    return {
      imageId: image.id,
      uploadUrl: signed.uploadUrl,
      method: 'PUT',
      headers: { 'Content-Type': image.contentType },
      expiresAt: signed.expiresAt.toISOString(),
    };
  }
  async complete(userId: string, productId: string, imageId: string) {
    const product = await this.owner(userId, productId);
    const image = await this.prisma.productImage.findFirst({ where: { id: imageId, productId } });
    if (!image || image.status === ProductImageStatus.DELETED)
      throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
    if (image.status === ProductImageStatus.READY) return this.map(image);
    const metadata = await this.storage.headObject(image.objectKey);
    if (
      !metadata ||
      metadata.sizeBytes !== image.sizeBytes ||
      metadata.contentType !== image.contentType
    ) {
      if (metadata) await this.storage.deleteObject(image.objectKey);
      await this.prisma.securityEvent.create({
        data: {
          userId,
          eventType: SecurityEventType.PRODUCT_IMAGE_UPLOAD_REJECTED,
          outcome: SecurityEventOutcome.BLOCKED,
          metadata: {
            productId,
            imageId,
            sellerProfileId: product.sellerProfileId,
            sizeBytes: image.sizeBytes,
            contentType: image.contentType,
            result: 'metadata_mismatch',
          },
        },
      });
      throw new AppError('PRODUCT_IMAGE_UPLOAD_INVALID', 'PRODUCT_IMAGE_UPLOAD_INVALID', 422, []);
    }
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product-images:${productId}`}, 0))`;
      const current = await tx.productImage.findUniqueOrThrow({ where: { id: imageId } });
      if (current.status === ProductImageStatus.READY) return this.map(current);
      const hasCover = await tx.productImage.count({
        where: { productId, status: ProductImageStatus.READY, isCover: true },
      });
      const ready = await tx.productImage.update({
        where: { id: imageId },
        data: { status: ProductImageStatus.READY, uploadedAt: new Date(), isCover: hasCover === 0 },
      });
      await this.audit(
        tx,
        userId,
        SecurityEventType.PRODUCT_IMAGE_UPLOAD_COMPLETED,
        product.sellerProfileId,
        ready,
        SecurityEventOutcome.SUCCESS,
      );
      return this.map(ready);
    });
  }
  async listSeller(userId: string, productId: string) {
    await this.owner(userId, productId);
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
    return { items: images.map((x) => this.map(x)), limit: PRODUCT_IMAGE_LIMIT };
  }
  async cover(userId: string, productId: string, imageId: string) {
    const product = await this.owner(userId, productId);
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product-images:${productId}`}, 0))`;
      const image = await tx.productImage.findFirst({
        where: { id: imageId, productId, status: ProductImageStatus.READY },
      });
      if (!image) throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
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
      return this.map(updated);
    });
  }
  async reorder(userId: string, productId: string, ids: string[]) {
    const product = await this.owner(userId, productId);
    if (new Set(ids).size !== ids.length)
      throw new AppError('PRODUCT_IMAGE_ORDER_INVALID', 'PRODUCT_IMAGE_ORDER_INVALID', 400, []);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product-images:${productId}`}, 0))`;
      const current = await tx.productImage.findMany({
        where: { productId, status: { not: ProductImageStatus.DELETED } },
        select: { id: true },
      });
      if (current.length !== ids.length || ids.some((id) => !current.some((x) => x.id === id)))
        throw new AppError('PRODUCT_IMAGE_ORDER_INVALID', 'PRODUCT_IMAGE_ORDER_INVALID', 400, []);
      await Promise.all(
        ids.map((id, sortOrder) => tx.productImage.update({ where: { id }, data: { sortOrder } })),
      );
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
    const product = await this.owner(userId, productId);
    const existing = await this.prisma.productImage.findFirst({
      where: { id: imageId, productId },
    });
    if (!existing)
      throw new AppError('PRODUCT_IMAGE_NOT_FOUND', 'PRODUCT_IMAGE_NOT_FOUND', 404, []);
    if (existing.status === ProductImageStatus.DELETED) return { deleted: true };
    await this.storage.deleteObject(existing.objectKey);
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`product-images:${productId}`}, 0))`;
      const current = await tx.productImage.findUniqueOrThrow({ where: { id: imageId } });
      if (current.status === ProductImageStatus.DELETED) return;
      await tx.productImage.update({
        where: { id: imageId },
        data: { status: ProductImageStatus.DELETED, deletedAt: new Date(), isCover: false },
      });
      if (current.isCover) {
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
        current,
        SecurityEventOutcome.SUCCESS,
      );
    });
    return { deleted: true };
  }
  private audit(
    tx: Prisma.TransactionClient,
    userId: string,
    eventType: SecurityEventType,
    sellerProfileId: string,
    image: {
      id: string;
      productId: string;
      objectKey: string;
      sizeBytes: number;
      contentType: string;
    },
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
