import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { cartService } from "@/services/cartService";
import { getUnavailabilityReason } from "@/services/productService";
import type { CartCoupon, CartItem, CartSummary, Product } from "@/types";

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  platformFee: number;
  total: number;
  coupon: CartCoupon | null;
  addItem: (product: Product, quantity?: number) => boolean;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => { ok: boolean; message: string };
  removeCoupon: () => void;
  summary: CartSummary;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<CartCoupon | null>(null);

  const addItem = useCallback((product: Product, quantity = 1) => {
    const reason = getUnavailabilityReason(product);
    if (reason) {
      toast.error(reason.toast);
      return false;
    }
    setItems((prev) => {
      const existing = prev.find((i) => i.productId === product.id);
      const maxStock = product.stock ?? 99;
      if (existing) {
        return prev.map((i) =>
          i.productId === product.id
            ? {
                ...i,
                quantity: Math.min(99, Math.min(maxStock, i.quantity + quantity)),
              }
            : i,
        );
      }
      return [...prev, cartService.buildCartItemFromProduct(product, quantity)];
    });
    return true;
  }, []);


  const removeItem = useCallback((productId: string) => {
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.productId !== productId);
      return prev.map((i) =>
        i.productId === productId ? { ...i, quantity: Math.min(99, quantity) } : i,
      );
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    setCoupon(null);
  }, []);

  const applyCoupon = useCallback((code: string) => {
    const result = cartService.validateCoupon(code);
    if (result.coupon) {
      setCoupon(result.coupon);
      return { ok: true, message: result.message };
    }
    return { ok: false, message: result.message };
  }, []);

  const removeCoupon = useCallback(() => setCoupon(null), []);

  const summary = useMemo(
    () => cartService.calculateCartSummary(items, coupon),
    [items, coupon],
  );

  const value: CartContextValue = {
    items,
    itemCount: summary.itemCount,
    subtotal: summary.subtotal,
    discount: summary.discount,
    platformFee: summary.platformFee,
    total: summary.total,
    coupon,
    addItem,
    removeItem,
    updateQuantity,
    clearCart,
    applyCoupon,
    removeCoupon,
    summary,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart deve ser usado dentro de <CartProvider>");
  return ctx;
}
