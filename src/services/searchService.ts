import { categoryService, productService } from "@/services/productService";
import { sellerService } from "@/services/sellerService";
import type {
  PopularSearch,
  Product,
  SearchFacets,
  SearchFilters,
  SearchResult,
  SearchSortDescriptor,
  SearchSortOption,
  SearchStats,
  SearchSuggestion,
} from "@/types";

/**
 * searchService — camada mockada de busca global.
 *
 * Nenhuma página deve consumir `@/data/*` diretamente para busca.
 * Toda navegação e listagem da rota /buscar deve passar por aqui.
 * O contrato foi desenhado para permitir substituição por API/backend
 * (Postgres full-text, Algolia, Meilisearch, etc.) sem alterar a UI.
 */

const delay = <T,>(data: T, ms = 220): Promise<T> =>
  new Promise((resolve) => setTimeout(() => resolve(data), ms));

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function tokenize(s: string): string[] {
  return normalize(s)
    .split(/\s+/g)
    .filter((t) => t.length > 0);
}

function scoreProduct(product: Product, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  const haystackParts = [
    product.title,
    product.categoryName,
    product.categorySlug,
    product.description ?? "",
    product.seller?.name ?? "",
    product.seller?.slug ?? "",
  ];
  const hay = normalize(haystackParts.join(" | "));
  let score = 0;
  for (const t of tokens) {
    if (!hay.includes(t)) return 0;
    if (normalize(product.title).includes(t)) score += 5;
    if (normalize(product.categoryName).includes(t)) score += 2;
    if (normalize(product.seller?.name ?? "").includes(t)) score += 2;
    score += 1;
  }
  return score;
}

function applyFilters(products: Product[], filters: SearchFilters): Product[] {
  return products.filter((p) => {
    if (filters.categorySlug && p.categorySlug !== filters.categorySlug) return false;
    if (filters.minPrice != null && p.price < filters.minPrice) return false;
    if (filters.maxPrice != null && p.price > filters.maxPrice) return false;
    if (filters.instantDelivery && !p.instantDelivery) return false;
    if (filters.verifiedSeller && !p.verifiedSeller) return false;
    if (filters.minRating != null && p.rating < filters.minRating) return false;
    if (filters.onlyAvailable) {
      const status = p.status ?? "active";
      if (status === "paused") return false;
      if (p.stock !== undefined && p.stock <= 0) return false;
    }
    return true;
  });
}

function sortProducts(
  products: Product[],
  sort: SearchSortOption,
  scores?: Map<string, number>,
): Product[] {
  const copy = [...products];
  switch (sort) {
    case "price_asc":
      return copy.sort((a, b) => a.price - b.price);
    case "price_desc":
      return copy.sort((a, b) => b.price - a.price);
    case "best_selling":
      return copy.sort((a, b) => b.soldCount - a.soldCount);
    case "best_rated":
      return copy.sort((a, b) => b.rating - a.rating);
    case "recent":
      return copy.reverse();
    case "relevance":
    default:
      if (!scores) return copy;
      return copy.sort(
        (a, b) => (scores.get(b.id) ?? 0) - (scores.get(a.id) ?? 0),
      );
  }
}

export const SEARCH_SORT_OPTIONS: SearchSortDescriptor[] = [
  { value: "relevance", label: "Mais relevantes" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "best_selling", label: "Mais vendidos" },
  { value: "best_rated", label: "Melhor avaliação" },
  { value: "recent", label: "Mais recentes" },
];

const POPULAR_TERMS: PopularSearch[] = [
  { id: "s1", term: "Valorant", hits: 1284 },
  { id: "s2", term: "Steam Gift Card", hits: 990 },
  { id: "s3", term: "FIFA Coins", hits: 812 },
  { id: "s4", term: "Skins CS2", hits: 654 },
  { id: "s5", term: "Netflix", hits: 421 },
  { id: "s6", term: "Free Fire", hits: 388 },
];

export const searchService = {
  async searchProducts(
    query: string,
    filters: SearchFilters = {},
    sort: SearchSortOption = "relevance",
  ): Promise<SearchResult> {
    const all = await productService.list();
    const tokens = tokenize(query);
    let candidates = all;
    let scores: Map<string, number> | undefined;

    if (tokens.length > 0) {
      scores = new Map();
      candidates = [];
      for (const p of all) {
        const s = scoreProduct(p, tokens);
        if (s > 0) {
          scores.set(p.id, s);
          candidates.push(p);
        }
      }
    }

    const filtered = applyFilters(candidates, filters);
    const sorted = sortProducts(filtered, sort, scores);

    return delay({
      query,
      products: sorted,
      total: sorted.length,
      sort,
      filters,
    });
  },

  getPopularSearches(): Promise<PopularSearch[]> {
    return delay(POPULAR_TERMS);
  },

  async getSearchSuggestions(query: string, limit = 6): Promise<SearchSuggestion[]> {
    const term = normalize(query);
    if (!term) return delay([]);
    const [all, cats, sellers] = await Promise.all([
      productService.list(),
      categoryService.list(),
      sellerService.list(),
    ]);
    const out: SearchSuggestion[] = [];

    for (const c of cats) {
      if (normalize(c.name).includes(term) || normalize(c.slug).includes(term)) {
        out.push({ id: `cat-${c.id}`, label: c.name, kind: "category" });
      }
    }
    for (const s of sellers) {
      if (normalize(s.name).includes(term)) {
        out.push({ id: `sel-${s.id}`, label: s.name, kind: "seller" });
      }
    }
    for (const p of all) {
      if (normalize(p.title).includes(term)) {
        out.push({ id: `pro-${p.id}`, label: p.title, kind: "product" });
      }
    }
    return delay(out.slice(0, limit));
  },

  async getSearchFilters(): Promise<SearchFacets> {
    const [all, cats] = await Promise.all([
      productService.list(),
      categoryService.list(),
    ]);
    const catCount = new Map<string, number>();
    let min = Infinity;
    let max = 0;
    for (const p of all) {
      catCount.set(p.categorySlug, (catCount.get(p.categorySlug) ?? 0) + 1);
      if (p.price < min) min = p.price;
      if (p.price > max) max = p.price;
    }
    return delay({
      categories: cats.map((c) => ({
        value: c.slug,
        label: c.name,
        count: catCount.get(c.slug) ?? 0,
      })),
      priceRange: {
        min: Number.isFinite(min) ? Math.floor(min) : 0,
        max: Math.ceil(max),
      },
    });
  },

  async getSearchStats(query: string): Promise<SearchStats> {
    const result = await this.searchProducts(query);
    const cats = new Set<string>();
    const sellers = new Set<string>();
    for (const p of result.products) {
      cats.add(p.categorySlug);
      if (p.seller?.id) sellers.add(p.seller.id);
    }
    return {
      query,
      total: result.total,
      categoriesMatched: cats.size,
      sellersMatched: sellers.size,
    };
  },
};
