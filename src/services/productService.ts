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

export const categoryService = {
  list: (): Promise<Category[]> => delay(categories),
  bySlug: (slug: string): Promise<Category | undefined> =>
    delay(categories.find((c) => c.slug === slug)),
};
