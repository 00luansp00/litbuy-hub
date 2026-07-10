import type { CartCoupon, CartItem, CartSummary, Product } from "@/types";

/**
 * cartService — camada mockada de regras do carrinho.
 * Centraliza cálculos e validação de cupom para substituição
 * futura por API/back-end sem alterar UI ou CartProvider.
 */

const PLATFORM_FEE_RATE = 0; // 0% enquanto está em fase visual

const COUPONS: Record<string, CartCoupon> = {
  LIT10: {
    code: "LIT10",
    kind: "percent",
    value: 10,
    label: "10% de desconto",
  },
  PRIMEIRA: {
    code: "PRIMEIRA",
    kind: "fixed",
    value: 15,
    label: "R$ 15,00 de desconto",
  },
};

function buildCartItemFromProduct(product: Product, quantity = 1): CartItem {
  return {
    productId: product.id,
    slug: product.slug,
    title: product.title,
    image: product.imageUrl,
    category: product.categoryName,
    categorySlug: product.categorySlug,
    sellerName: product.seller?.name ?? "LIT Seller",
    sellerSlug: product.seller?.slug,
    price: product.price,
    oldPrice: product.originalPrice,
    quantity: Math.max(1, Math.min(99, quantity)),
    instantDelivery: product.instantDelivery,
    verifiedSeller: product.verifiedSeller ?? product.seller?.verified,
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

function validateCoupon(code: string): {
  coupon: CartCoupon | null;
  message: string;
} {
  const normalized = code.trim().toUpperCase();
  if (!normalized) return { coupon: null, message: "Informe um código de cupom." };
  const coupon = COUPONS[normalized];
  if (!coupon)
    return { coupon: null, message: "Cupom inválido ou expirado." };
  return { coupon, message: `Cupom ${coupon.code} aplicado — ${coupon.label}.` };
}

export const cartService = {
  buildCartItemFromProduct,
  calculateCartSummary,
  validateCoupon,
};
