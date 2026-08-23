import { HttpStatus, Injectable } from '@nestjs/common';
import {
  Cart,
  CartItem,
  CartStatus,
  Prisma,
  SecurityEventOutcome,
  SecurityEventType,
} from '@prisma/client';
import { AppError } from '../common/errors/app-error';
import { PrismaService } from '../database/prisma.service';
import { minorUnitsJson } from './cart-pricing';
import { assertCartSelection, basePurchasable } from './cart-purchasability';
import type {
  AddCartItemDto,
  CartListQueryDto,
  RemoveCartItemDto,
  UpdateCartItemDto,
} from './carts.dto';
import { buyerVipCheckoutFingerprint, checkoutFingerprint } from '../checkout/checkout-fingerprint';
import { ListingTierPolicyService } from '../financial/listing-tier-policy.service';

export const cartProductInclude = {
  sellerProfile: { select: { userId: true, status: true } },
  sourceListingDraft: {
    select: {
      status: true,
      categoryId: true,
      subcategoryId: true,
      productType: true,
      requestedPromotionTier: true,
      requestedSellerPlan: true,
    },
  },
  category: { select: { status: true } },
  subcategory: { select: { status: true, categoryId: true } },
  images: { select: { status: true, isCover: true } },
  variants: {
    select: { id: true, productId: true, title: true, status: true, price: true, stock: true },
  },
  serviceDetails: {
    select: {
      pricingType: true,
      basePrice: true,
      estimatedDelivery: true,
      buyerRequirements: true,
    },
  },
} satisfies Prisma.ProductInclude;
export type CartProductPayload = Prisma.ProductGetPayload<{ include: typeof cartProductInclude }>;
export const cartResponseInclude = {
  sellerProfile: { select: { id: true, slug: true, storeName: true } },
  items: {
    orderBy: [{ createdAt: 'asc' as const }, { id: 'asc' as const }],
    include: {
      product: { include: cartProductInclude },
      variant: { select: { id: true, title: true } },
    },
  },
} satisfies Prisma.CartInclude;
type PrismaCartResponsePayload = Prisma.CartGetPayload<{ include: typeof cartResponseInclude }>;
export type CartResponsePayload = Omit<PrismaCartResponsePayload, 'checkedOutAt'> & {
  checkedOutAt?: Date | null;
};
type Tx = Prisma.TransactionClient;
type MutableCart = Pick<Cart, 'id' | 'buyerUserId' | 'sellerProfileId' | 'status' | 'version'>;
type MutableCartItem = Pick<
  CartItem,
  'id' | 'cartId' | 'productId' | 'productVariantId' | 'quantity'
>;
type MutationAction = (tx: Tx, cart: MutableCart, item: MutableCartItem) => Promise<void>;
const ITEM_UNIQUE_TARGETS = [
  'CartItem_cartId_key',
  'cartId',
  'CartItem_product_without_variant_key',
  'CartItem_product_with_variant_key',
  'cartId,productId',
  'cartId,productId,productVariantId',
];

@Injectable()
export class CartsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly listingTierPolicy: ListingTierPolicyService,
  ) {}
  async list(buyerUserId: string, q: CartListQueryDto) {
    const carts = await this.prisma.cart.findMany({
      where: { buyerUserId, status: CartStatus.ACTIVE },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      skip: (q.page - 1) * q.limit,
      take: q.limit,
      include: cartResponseInclude,
    });
    return {
      page: q.page,
      limit: q.limit,
      items: await Promise.all(carts.map((cart) => this.response(cart))),
    };
  }
  async get(buyerUserId: string, sellerSlug: string) {
    const cart = await this.prisma.cart.findFirst({
      where: { buyerUserId, status: CartStatus.ACTIVE, sellerProfile: { slug: sellerSlug } },
      include: cartResponseInclude,
    });
    if (!cart) this.fail('CART_NOT_FOUND', HttpStatus.NOT_FOUND);
    return this.response(cart);
  }
  async add(buyerUserId: string, sellerSlug: string, dto: AddCartItemDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const seller = await tx.sellerProfile.findUnique({ where: { slug: sellerSlug } });
        if (!seller) this.fail('PRODUCT_NOT_PURCHASABLE', 422);
        await this.lock(tx, buyerUserId, seller.id);
        let cart = await tx.cart.findFirst({
          where: { buyerUserId, sellerProfileId: seller.id, status: CartStatus.ACTIVE },
        });
        if ((!cart && dto.expectedVersion !== 0) || (cart && cart.version !== dto.expectedVersion))
          this.versionConflict(cart?.version ?? null);
        const product = await tx.product.findUnique({
          where: { id: dto.productId },
          include: cartProductInclude,
        });
        assertCartSelection(product, {
          sellerProfileId: seller.id,
          buyerUserId,
          productVariantId: dto.productVariantId,
          quantity: dto.quantity,
        });
        const created = cart === null;
        if (cart === null)
          cart = await tx.cart.create({ data: { buyerUserId, sellerProfileId: seller.id } });
        else {
          const duplicate = await tx.cartItem.findFirst({
            where: {
              cartId: cart.id,
              productId: dto.productId,
              productVariantId: dto.productVariantId ?? null,
            },
            select: { id: true },
          });
          if (duplicate) this.fail('CART_ITEM_ALREADY_EXISTS', 409);
          if (await tx.cartItem.findFirst({ where: { cartId: cart.id }, select: { id: true } }))
            this.fail('CART_SINGLE_SKU_REQUIRED', 409);
          await this.bumpVersion(tx, cart, dto.expectedVersion);
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
            sellerProfileId: seller.id,
            previousVersion: 0,
            nextVersion: 1,
            action: 'CREATE',
          });
        await this.audit(tx, SecurityEventType.CART_ITEM_ADDED, buyerUserId, {
          cartId: cart.id,
          cartItemId: item.id,
          buyerUserId,
          sellerProfileId: seller.id,
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
    } catch (error: unknown) {
      if (this.isUniqueViolation(error, ITEM_UNIQUE_TARGETS))
        this.fail('CART_ITEM_ALREADY_EXISTS', 409);
      if (
        this.isUniqueViolation(error, [
          'Cart_active_buyer_seller_key',
          'buyerUserId,sellerProfileId',
        ])
      ) {
        const current = await this.prisma.cart.findFirst({
          where: { buyerUserId, status: CartStatus.ACTIVE, sellerProfile: { slug: sellerSlug } },
          select: { version: true },
        });
        this.versionConflict(current?.version ?? null);
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        this.fail('CART_MUTATION_CONFLICT', 409);
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
        const product = await tx.product.findUnique({
          where: { id: item.productId },
          include: cartProductInclude,
        });
        assertCartSelection(product, {
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
    action: MutationAction,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const seller = await tx.sellerProfile.findUnique({ where: { slug } });
      if (!seller) this.fail('CART_NOT_FOUND', 404);
      await this.lock(tx, buyerUserId, seller.id);
      const cart = await tx.cart.findFirst({
        where: { buyerUserId, sellerProfileId: seller.id, status: CartStatus.ACTIVE },
      });
      if (!cart) this.versionConflict(null);
      if (cart.version !== expectedVersion) this.versionConflict(cart.version);
      const item = await tx.cartItem.findFirst({
        where: { id: itemId, cartId: cart.id, cart: { buyerUserId } },
      });
      if (!item) this.fail('CART_ITEM_NOT_FOUND', 404);
      await this.bumpVersion(tx, cart, expectedVersion);
      await action(tx, cart, item);
      return this.load(tx, cart.id, buyerUserId);
    });
  }
  private async bumpVersion(tx: Tx, cart: MutableCart, expectedVersion: number) {
    const bumped = await tx.cart.updateMany({
      where: { id: cart.id, version: expectedVersion },
      data: { version: { increment: 1 } },
    });
    if (bumped.count !== 1) this.versionConflict(cart.version);
  }
  private async lock(tx: Tx, buyer: string, seller: string) {
    await tx.$queryRaw`WITH cart_lock AS MATERIALIZED (SELECT pg_advisory_xact_lock(hashtext(${'buyer-cart:' + buyer + ':' + seller}))) SELECT 1::integer AS "acquired" FROM cart_lock`;
  }
  private async load(tx: Tx, id: string, buyerUserId: string) {
    const cart = await tx.cart.findFirstOrThrow({
      where: { id, buyerUserId },
      include: cartResponseInclude,
    });
    return this.response(cart);
  }
  private async response(cart: CartResponsePayload) {
    let subtotal = 0n;
    let ready = cart.items.length === 1;
    const items = cart.items.map((item) => {
      const issues: string[] = [];
      let unit: bigint | null = null;
      if (!basePurchasable(item.product, cart.sellerProfile.id)) issues.push('PRODUCT_UNAVAILABLE');
      else
        try {
          unit = assertCartSelection(item.product, {
            sellerProfileId: cart.sellerProfile.id,
            buyerUserId: cart.buyerUserId,
            productVariantId: item.productVariantId ?? undefined,
            quantity: item.quantity,
          }).unitMinor;
        } catch (error: unknown) {
          const code = error instanceof AppError ? error.code : 'PRODUCT_NOT_PURCHASABLE';
          const issue: Record<string, string> = {
            PRODUCT_VARIANT_NOT_AVAILABLE: 'VARIANT_UNAVAILABLE',
            INSUFFICIENT_STOCK: 'OUT_OF_STOCK',
            PRODUCT_REQUIRES_QUOTE: 'REQUIRES_QUOTE',
            QUANTITY_UNAVAILABLE: 'QUANTITY_UNAVAILABLE',
          };
          issues.push(issue[code] ?? 'PRODUCT_UNAVAILABLE');
        }
      const line = unit === null ? null : unit * BigInt(item.quantity);
      if (issues.length || line === null) ready = false;
      else subtotal += line;
      return {
        id: item.id,
        quantity: item.quantity,
        product: {
          id: item.product.id,
          slug: item.product.slug,
          title: item.product.title,
          model: item.product.model,
        },
        variant: item.variant ? { id: item.variant.id, title: item.variant.title } : null,
        currentUnitAmountMinor: unit === null ? null : minorUnitsJson(unit),
        currentLineAmountMinor: line === null ? null : minorUnitsJson(line),
        purchasable: issues.length === 0,
        issues,
      };
    });
    const response = {
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
    const previewFingerprint = checkoutFingerprint({
      cartId: cart.id,
      cartVersion: cart.version,
      sellerId: cart.sellerProfile.id,
      currency: 'BRL',
      items: cart.items.map((item, index) => ({
        id: item.id,
        productId: item.product.id,
        productVersion: item.product.version,
        variantId: item.productVariantId,
        quantity: item.quantity,
        unitAmountMinor: items[index].currentUnitAmountMinor,
        purchasable: items[index].purchasable,
        issues: items[index].issues,
      })),
    });
    const quotes = ready ? await this.listingTierPolicy.buyerVipOptions(subtotal) : [];
    const buyerVipOptions = Object.fromEntries(
      quotes.map((quote) => [
        quote.plan,
        {
          plan: quote.plan,
          percentBps: quote.percentBps,
          feeAmountMinor: minorUnitsJson(quote.feeAmountMinor),
          totalAmountMinor: minorUnitsJson(quote.totalAmountMinor),
          fingerprint: buyerVipCheckoutFingerprint(previewFingerprint, quote),
        },
      ]),
    );
    return {
      ...response,
      previewFingerprint,
      buyerVipOptions,
      buyerVipPreviewFingerprints: Object.fromEntries(
        Object.entries(buyerVipOptions).map(([plan, quote]) => [plan, quote.fingerprint]),
      ),
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
  private isUniqueViolation(error: unknown, targets: string[]): boolean {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002')
      return false;
    const target = error.meta?.target;
    const values = Array.isArray(target)
      ? target.filter((value): value is string => typeof value === 'string')
      : typeof target === 'string'
        ? [target]
        : [];
    const representations = [...values, values.join(',')];
    return targets.some((name) => representations.some((value) => value.includes(name)));
  }
  private versionConflict(currentVersion: number | null): never {
    throw new AppError('CART_VERSION_CONFLICT', 'CART_VERSION_CONFLICT', 409, [{ currentVersion }]);
  }
  private fail(code: string, status: number): never {
    throw new AppError(code, code, status, []);
  }
}
