import { products } from "@/data/products";
import { getUnavailabilityReason } from "@/services/productService";
import type {
  CartCoupon,
  CartItem,
  CartSummary,
  ListingVariant,
  Product,
} from "@/types";

/**
 * cartService — camada mockada de regras do carrinho.
 * Suporta variação selecionada (produto dinâmico) e cotação de moeda virtual
 * a partir da Sprint 18.8. O item é identificado pela chave composta `key`
 * (productId, productId::variantId ou productId::vc::qty).
 */

const PLATFORM_FEE_RATE = 0;

const COUPONS: Record<string, CartCoupon> = {
  LIT10: { code: "LIT10", kind: "percent", value: 10, label: "10% de desconto" },
  PRIMEIRA: {
    code: "PRIMEIRA",
    kind: "fixed",
    value: 15,
    label: "R$ 15,00 de desconto",
  },
};

export interface BuildCartItemOptions {
  quantity?: number;
  variant?: ListingVariant;
  /** Sobrescreve preço unitário (moeda virtual). */
  unitPriceOverride?: number;
  /** Sobrescreve título exibido (moeda virtual, ex: "50.000 Gold"). */
  titleOverride?: string;
  /** Marca item como cotação de moeda virtual. */
  virtualCurrencyUnit?: string;
}

function buildKey(
  productId: string,
  variantId?: string,
  virtualCurrencyUnit?: string,
  quantity?: number,
): string {
  if (variantId) return `${productId}::${variantId}`;
  if (virtualCurrencyUnit) return `${productId}::vc::${quantity ?? 1}`;
  return productId;
}

function buildCartItemFromProduct(
  product: Product,
  opts: BuildCartItemOptions = {},
): CartItem {
  const { quantity = 1, variant, unitPriceOverride, titleOverride, virtualCurrencyUnit } = opts;
  const unitPrice = unitPriceOverride ?? variant?.price ?? product.price;
  return {
    key: buildKey(product.id, variant?.id, virtualCurrencyUnit, quantity),
    productId: product.id,
    slug: product.slug,
    title: titleOverride ?? product.title,
    image: product.coverImage ?? product.imageUrl,
    category: product.categoryName,
    categorySlug: product.categorySlug,
    sellerName: product.seller?.name ?? "LIT Seller",
    sellerSlug: product.seller?.slug,
    price: unitPrice,
    oldPrice: unitPriceOverride ? undefined : product.originalPrice,
    quantity: Math.max(1, Math.min(9999, quantity)),
    instantDelivery: product.instantDelivery,
    verifiedSeller: product.verifiedSeller ?? product.seller?.verified,
    selectedVariantId: variant?.id,
    selectedVariantTitle: variant?.title,
    selectedVariantPrice: variant?.price,
    virtualCurrencyUnit,
  };
}

function calculateCartSummary(
  items: CartItem[],
  coupon: CartCoupon | null = null,
): CartSummary {
  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);
  const subtotal = items.reduce((acc, i) => acc + i.price * i.quantity, 0);

  let discount = 0;
  if (coupon && subtotal > 0) {
    discount =
      coupon.kind === "percent"
        ? (subtotal * coupon.value) / 100
        : Math.min(subtotal, coupon.value);
  }

  const platformFee = subtotal > 0 ? subtotal * PLATFORM_FEE_RATE : 0;
  const total = Math.max(0, subtotal - discount + platformFee);

  return { itemCount, subtotal, discount, platformFee, total };
}

function validateCoupon(code: string): { coupon: CartCoupon | null; message: string } {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { coupon: null, message: "Informe um código de cupom." };
  const coupon = COUPONS[normalized];
  if (!coupon) return { coupon: null, message: "Cupom inválido ou expirado." };
  return { coupon, message: `Cupom ${coupon.code} aplicado — ${coupon.label}.` };
}

export interface CartUnavailableEntry {
  item: CartItem;
  reason: NonNullable<ReturnType<typeof getUnavailabilityReason>>;
}

function findUnavailableItems(items: CartItem[]): CartUnavailableEntry[] {
  const out: CartUnavailableEntry[] = [];
  for (const item of items) {
    const product = products.find((p) => p.id === item.productId);
    if (!product) continue;
    const reason = getUnavailabilityReason(product);
    if (reason) out.push({ item, reason });
  }
  return out;
}

export const cartService = {
  buildCartItemFromProduct,
  calculateCartSummary,
  validateCoupon,
  findUnavailableItems,
  buildKey,
};
