import { HttpStatus, Injectable } from '@nestjs/common';
import { CartStatus, Prisma, SecurityEventOutcome, SecurityEventType } from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { minorUnitsJson } from './cart-pricing';
import { assertCartSelection, basePurchasable, type CartProduct } from './cart-purchasability';
import type {
  AddCartItemDto,
  CartListQueryDto,
  RemoveCartItemDto,
  UpdateCartItemDto,
} from './carts.dto';

const productInclude = {
  sellerProfile: true,
  sourceListingDraft: true,
  category: true,
  subcategory: true,
  images: { select: { status: true, isCover: true } },
  variants: true,
  serviceDetails: true,
} as const;
const cartInclude = {
  sellerProfile: { select: { id: true, slug: true, storeName: true } },
  items: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    include: {
      product: { include: productInclude },
      variant: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.CartInclude;
type Tx = Prisma.TransactionClient;
@Injectable()
export class CartsService {
  constructor(private readonly prisma: PrismaService) {}
  async list(buyerUserId: string, q: CartListQueryDto) {
    const carts = await this.prisma.cart.findMany({
      where: { buyerUserId, status: CartStatus.ACTIVE },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: cartInclude,
    });
    return { page: q.page, limit: q.limit, items: carts.map((c) => this.response(c)) };
  }
  async get(buyerUserId: string, sellerSlug: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { buyerUserId, status: CartStatus.ACTIVE, sellerProfile: { slug: sellerSlug } },
      include: cartInclude,
    });
    if (!cart) this.fail('CART_NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.response(cart!);
  }
  async add(buyerUserId: string, sellerSlug: string, dto: AddCartItemDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const seller = await tx.sellerProfile.findUnique({ where: { slug: sellerSlug } });
        if (!seller) this.fail('PRODUCT_NOT_PURCHASABLE', 422);
        await this.lock(tx, buyerUserId, seller!.id);
        let cart = await tx.cart.findFirst({
          where: { buyerUserId, sellerProfileId: seller!.id, status: CartStatus.ACTIVE },
        });
        if ((!cart && dto.expectedVersion !== 0) || (cart && cart.version !== dto.expectedVersion))
          this.versionConflict(cart?.version ?? null);
        const product = await tx.product.findFirst({
          where: { id: dto.productId },
          include: productInclude,
        });
        assertCartSelection(product as CartProduct | null, {
          sellerProfileId: seller!.id,
          buyerUserId,
          productVariantId: dto.productVariantId,
          quantity: dto.quantity,
        });
        let created = false;
        if (!cart) {
          cart = await tx.cart.create({ data: { buyerUserId, sellerProfileId: seller!.id } });
          created = true;
        } else {
          if ((await tx.cartItem.count({ where: { cartId: cart.id } })) >= 50)
            this.fail('CART_ITEM_LIMIT_REACHED', 409);
          const bumped = await tx.cart.updateMany({
            where: { id: cart.id, version: dto.expectedVersion },
            data: { version: { increment: 1 } },
          });
          if (bumped.count !== 1) this.versionConflict(cart.version);
        }
        const item = await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: dto.productId,
            productVariantId: dto.productVariantId,
            quantity: dto.quantity,
          },
        });
        if (created)
          await this.audit(tx, SecurityEventType.CART_CREATED, buyerUserId, {
            cartId: cart.id,
            buyerUserId,
            sellerProfileId: seller!.id,
            previousVersion: 0,
            nextVersion: 1,
            action: 'CREATE',
          });
        await this.audit(tx, SecurityEventType.CART_ITEM_ADDED, buyerUserId, {
          cartId: cart.id,
          cartItemId: item.id,
          buyerUserId,
          sellerProfileId: seller!.id,
          productId: dto.productId,
          productVariantId: dto.productVariantId ?? null,
          previousQuantity: null,
          nextQuantity: dto.quantity,
          previousVersion: dto.expectedVersion,
          nextVersion: created ? 1 : dto.expectedVersion + 1,
          action: 'ADD_ITEM',
        });
        return this.load(tx, cart.id, buyerUserId);
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        this.fail('CART_ITEM_ALREADY_EXISTS', 409);
      throw error;
    }
  }
  async update(buyerUserId: string, sellerSlug: string, itemId: string, dto: UpdateCartItemDto) {
    return this.mutate(
      buyerUserId,
      sellerSlug,
      itemId,
      dto.expectedVersion,
      async (tx, cart, item) => {
        const product = await tx.product.findFirst({
          where: { id: item.productId },
          include: productInclude,
        });
        assertCartSelection(product as CartProduct | null, {
          sellerProfileId: cart.sellerProfileId,
          buyerUserId,
          productVariantId: item.productVariantId ?? undefined,
          quantity: dto.quantity,
        });
        await tx.cartItem.update({ where: { id: item.id }, data: { quantity: dto.quantity } });
        await this.audit(tx, SecurityEventType.CART_ITEM_UPDATED, buyerUserId, {
          cartId: cart.id,
          cartItemId: item.id,
          buyerUserId,
          sellerProfileId: cart.sellerProfileId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          previousQuantity: item.quantity,
          nextQuantity: dto.quantity,
          previousVersion: dto.expectedVersion,
          nextVersion: dto.expectedVersion + 1,
          action: 'UPDATE_ITEM',
        });
      },
    );
  }
  async remove(buyerUserId: string, sellerSlug: string, itemId: string, dto: RemoveCartItemDto) {
    return this.mutate(
      buyerUserId,
      sellerSlug,
      itemId,
      dto.expectedVersion,
      async (tx, cart, item) => {
        await tx.cartItem.delete({ where: { id: item.id } });
        await this.audit(tx, SecurityEventType.CART_ITEM_REMOVED, buyerUserId, {
          cartId: cart.id,
          cartItemId: item.id,
          buyerUserId,
          sellerProfileId: cart.sellerProfileId,
          productId: item.productId,
          productVariantId: item.productVariantId,
          previousQuantity: item.quantity,
          nextQuantity: null,
          previousVersion: dto.expectedVersion,
          nextVersion: dto.expectedVersion + 1,
          action: 'REMOVE_ITEM',
        });
      },
    );
  }
  private async mutate(
    buyerUserId: string,
    slug: string,
    itemId: string,
    expectedVersion: number,
    action: (tx: Tx, cart: any, item: any) => Promise<void>,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const seller = await tx.sellerProfile.findUnique({ where: { slug } });
      if (!seller) this.fail('CART_NOT_FOUND', 404);
      await this.lock(tx, buyerUserId, seller!.id);
      const cart = await tx.cart.findFirst({
        where: { buyerUserId, sellerProfileId: seller!.id, status: CartStatus.ACTIVE },
      });
      if (!cart) this.versionConflict(null);
      if (cart!.version !== expectedVersion) this.versionConflict(cart!.version);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId: cart!.id, cart: { buyerUserId } },
      });
      if (!item) this.fail('CART_ITEM_NOT_FOUND', 404);
      const bumped = await tx.cart.updateMany({
        where: { id: cart!.id, version: expectedVersion },
        data: { version: { increment: 1 } },
      });
      if (bumped.count !== 1) this.versionConflict(cart!.version);
      await action(tx, cart, item);
      return this.load(tx, cart!.id, buyerUserId);
    });
  }
  private async lock(tx: Tx, buyer: string, seller: string) {
    await tx.$queryRaw`WITH cart_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${'buyer-cart:' + buyer + ':' + seller}))) SELECT 1::integer AS "acquired" FROM cart_lock`;
  }
  private async load(tx: Tx, id: string, buyerUserId: string) {
    const cart = await tx.cart.findFirstOrThrow({
      where: { id, buyerUserId },
      include: cartInclude,
    });
    return this.response(cart);
  }
  private response(cart: any) {
    let subtotal = 0n;
    let ready = cart.items.length > 0;
    const items = cart.items.map((item: any) => {
      const p = item.product as CartProduct;
      const issues: string[] = [];
      let unit: bigint | null = null;
      if (!basePurchasable(p, cart.sellerProfile.id)) issues.push('PRODUCT_UNAVAILABLE');
      else {
        try {
          const result = assertCartSelection(p, {
            sellerProfileId: cart.sellerProfile.id,
            buyerUserId: '',
            productVariantId: item.productVariantId ?? undefined,
            quantity: item.quantity,
          });
          unit = result.unitMinor;
        } catch (e) {
          const code = e instanceof AppError ? e.code : 'PRICE_UNAVAILABLE';
          const map: Record<string, string> = {
            PRODUCT_VARIANT_NOT_AVAILABLE: 'VARIANT_UNAVAILABLE',
            INSUFFICIENT_STOCK: 'OUT_OF_STOCK',
            PRODUCT_REQUIRES_QUOTE: 'REQUIRES_QUOTE',
            QUANTITY_UNAVAILABLE: 'QUANTITY_UNAVAILABLE',
            PRODUCT_NOT_PURCHASABLE: 'PRICE_UNAVAILABLE',
          };
          issues.push(map[code] ?? 'PRODUCT_UNAVAILABLE');
        }
      }
      const line = unit === null ? null : unit * BigInt(item.quantity);
      if (issues.length || line === null) ready = false;
      else subtotal += line;
      return {
        id: item.id,
        quantity: item.quantity,
        product: { id: p.id, slug: p.slug, title: p.title, model: p.model },
        variant: item.variant ? { id: item.variant.id, title: item.variant.title } : null,
        currentUnitAmountMinor: unit === null ? null : minorUnitsJson(unit),
        currentLineAmountMinor: line === null ? null : minorUnitsJson(line),
        purchasable: issues.length === 0,
        issues,
      };
    });
    return {
      id: cart.id,
      status: cart.status,
      version: cart.version,
      currency: 'BRL',
      seller: { slug: cart.sellerProfile.slug, storeName: cart.sellerProfile.storeName },
      items,
      previewSubtotalMinor: ready ? minorUnitsJson(subtotal) : null,
      checkoutReady: ready,
      createdAt: cart.createdAt.toISOString(),
      updatedAt: cart.updatedAt.toISOString(),
    };
  }
  private audit(
    tx: Tx,
    eventType: SecurityEventType,
    userId: string,
    metadata: Prisma.InputJsonObject,
  ) {
    return tx.securityEvent.create({
      data: { userId, eventType, outcome: SecurityEventOutcome.SUCCESS, metadata },
    });
  }
  private versionConflict(currentVersion: number | null): never {
    throw new AppError('CART_VERSION_CONFLICT', 'CART_VERSION_CONFLICT', 409, [{ currentVersion }]);
  }
  private fail(code: string, status: number): never {
    throw new AppError(code, code, status, []);
  }
}
