import { products } from "@/data/products";
import { categories } from "@/data/categories";
import type { Product, Category } from "@/types";

/**
 * Mock service layer.
 * All functions are async and return Promises so we can swap to a real REST
 * backend later without changing consumers.
 */

const delay = <T,>(data: T, ms = 200): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

export const productService = {
  list: (): Promise<Product[]> => delay(products),
  featured: (): Promise<Product[]> =>
    delay(products.filter((p) => p.badge === "hot" || p.badge === "top")),
  popular: (): Promise<Product[]> =>
    delay([...products].sort((a, b) => b.soldCount - a.soldCount).slice(0, 8)),
  recent: (): Promise<Product[]> => delay(products.slice(-8).reverse()),
  byCategory: (slug: string): Promise<Product[]> =>
    delay(products.filter((p) => p.categorySlug === slug)),
  byId: (id: string): Promise<Product | undefined> =>
    delay(products.find((p) => p.id === id || p.slug === id)),
  related: (id: string, limit = 8): Promise<Product[]> => {
    const base = products.find((p) => p.id === id || p.slug === id);
    if (!base) return delay([]);
    const same = products.filter(
      (p) => p.categorySlug === base.categorySlug && p.id !== base.id,
    );
    return delay(same.slice(0, limit));
  },
};

/**
 * Regra centralizada de disponibilidade de produto (mock).
 * Produto disponível se `status !== "paused"` e `stock > 0`.
 * Campos ausentes são tratados como disponíveis para retrocompatibilidade.
 */
export function isProductAvailable(product: Pick<Product, "status" | "stock">): boolean {
  const status = product.status ?? "active";
  if (status === "paused") return false;
  if (product.stock !== undefined && product.stock <= 0) return false;
  return true;
}

/**
 * Motivo textual/tone de indisponibilidade — usado por UI para exibir
 * badge, toast e estados de botão. Retorna null quando disponível.
 */
export function getUnavailabilityReason(
  product: Pick<Product, "status" | "stock">,
): { kind: "sold_out" | "paused"; label: string; toast: string } | null {
  const status = product.status ?? "active";
  if (status === "paused") {
    return {
      kind: "paused",
      label: "Indisponível",
      toast: "Produto indisponível no momento.",
    };
  }
  if (product.stock !== undefined && product.stock <= 0) {
    return {
      kind: "sold_out",
      label: "Esgotado",
      toast: "Produto esgotado no momento.",
    };
  }
  return null;
}


export const categoryService = {
  list: (): Promise<Category[]> => delay(categories),
  bySlug: (slug: string): Promise<Category | undefined> =>
    delay(categories.find((c) => c.slug === slug)),
};
