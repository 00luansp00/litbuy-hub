import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { cartService, type BuildCartItemOptions } from "@/services/cartService";
import { getUnavailabilityReason } from "@/services/productService";
import type { CartCoupon, CartItem, CartSummary, ListingVariant, Product } from "@/types";

export interface AddItemOptions {
  quantity?: number;
  variant?: ListingVariant;
  unitPriceOverride?: number;
  titleOverride?: string;
  virtualCurrencyUnit?: string;
  silent?: boolean;
}

interface CartContextValue {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discount: number;
  platformFee: number;
  total: number;
  coupon: CartCoupon | null;
  addItem: (product: Product, options?: AddItemOptions) => CartItem | null;
  removeItem: (key: string) => void;
  updateQuantity: (key: string, quantity: number) => void;
  clearCart: () => void;
  applyCoupon: (code: string) => { ok: boolean; message: string };
  removeCoupon: () => void;
  summary: CartSummary;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [coupon, setCoupon] = useState<CartCoupon | null>(null);

  const addItem = useCallback((product: Product, options: AddItemOptions = {}) => {
    const reason = getUnavailabilityReason(product);
    if (reason) {
      if (!options.silent) toast.error(reason.toast);
      return null;
    }
    if (product.listingModel === "dynamic" && !options.variant) {
      if (!options.silent) {
        toast.error("Selecione uma variação antes de adicionar ao carrinho.");
      }
      return null;
    }
    if (options.variant) {
      if (options.variant.status === "paused") {
        if (!options.silent) toast.error("Variação indisponível no momento.");
        return null;
      }
      if (options.variant.stock <= 0) {
        if (!options.silent) toast.error("Variação sem estoque.");
        return null;
      }
    }

    const build: BuildCartItemOptions = {
      quantity: options.quantity ?? 1,
      variant: options.variant,
      unitPriceOverride: options.unitPriceOverride,
      titleOverride: options.titleOverride,
      virtualCurrencyUnit: options.virtualCurrencyUnit,
    };
    const newItem = cartService.buildCartItemFromProduct(product, build);

    setItems((prev) => {
      const existing = prev.find((i) => i.key === newItem.key);
      if (existing) {
        const maxStock = options.variant?.stock ?? product.stock ?? 9999;
        const nextQty = Math.min(9999, Math.min(maxStock, existing.quantity + newItem.quantity));
        return prev.map((i) => (i.key === newItem.key ? { ...i, quantity: nextQty } : i));
      }
      return [...prev, newItem];
    });
    return newItem;
  }, []);

  const removeItem = useCallback((key: string) => {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }, []);

  const updateQuantity = useCallback((key: string, quantity: number) => {
    setItems((prev) => {
      if (quantity <= 0) return prev.filter((i) => i.key !== key);
      return prev.map((i) =>
        i.key === key ? { ...i, quantity: Math.min(9999, quantity) } : i,
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
