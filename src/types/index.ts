export interface Category {
  id: string;
  slug: string;
  name: string;
  icon: string; // lucide icon name
  description?: string;
  /** Quantidade de anúncios ativos na categoria (mock). */
  listingCount?: number;
  /** Cor de destaque (token semântico ou variável CSS). */
  color?: string;
  /** @deprecated Use `listingCount`. Mantido apenas para compatibilidade. */
  productCount?: number;
}

export interface Seller {
  id: string;
  name: string;
  avatarUrl?: string;
  rating: number;
  verified?: boolean;
}

export interface Product {
  id: string;
  slug: string;
  title: string;
  description?: string;
  categorySlug: string;
  categoryName: string;
  price: number;
  originalPrice?: number;
  discountPercent?: number;
  rating: number;
  reviewsCount: number;
  soldCount: number;
  imageUrl: string;
  badge?: "hot" | "new" | "promo" | "top";
  seller?: Seller;
  stock?: number;
  instantDelivery?: boolean;
  verifiedSeller?: boolean;
  /** 0-100 — indicador de confiança agregado do anúncio. */
  trustScore?: number;
  /** Marca explicitamente o anúncio como "Mais vendido". */
  bestSeller?: boolean;
}
