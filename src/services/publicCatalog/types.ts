export type PublicCatalogProductType =
  | "ACCOUNT"
  | "VIRTUAL_CURRENCY"
  | "GIFT_CARD"
  | "KEY"
  | "SKIN"
  | "ITEM"
  | "SERVICE"
  | "SUBSCRIPTION"
  | "GAME"
  | "SOFTWARE"
  | "OTHER";

export type PublicCatalogModel = "NORMAL" | "DYNAMIC" | "SERVICE";
export type PublicCatalogDeliveryMode = "MANUAL" | "AUTOMATIC";
export type PublicCatalogSort = "RECENT" | "OLDEST" | "TITLE_ASC" | "TITLE_DESC";

export type PublicCatalogPricing =
  | { kind: "FIXED"; amount: string }
  | { kind: "FROM"; amount: string }
  | { kind: "QUOTE"; amount: null };

export interface PublicCatalogCard {
  id: string;
  slug: string;
  title: string;
  shortDescription: string;
  productType: PublicCatalogProductType;
  model: PublicCatalogModel;
  pricing: PublicCatalogPricing;
  stock: number | null;
  category: { slug: string; name: string };
  subcategory: { slug: string; name: string } | null;
  seller: { slug: string; storeName: string; verified: boolean };
  coverImage: { url: string; expiresAt: string; altText: string | null };
}

export interface PublicCatalogVariant {
  id: string;
  title: string;
  description: string | null;
  price: string;
  stock: number;
}

export interface PublicCatalogGalleryImage {
  id: string;
  url: string;
  expiresAt: string;
  altText: string | null;
  isCover: boolean;
}

export type PublicCatalogServiceDetails =
  | { pricingType: "FIXED"; basePrice: string; estimatedDelivery: string }
  | { pricingType: "QUOTE"; basePrice: null; estimatedDelivery: string };

export interface PublicCatalogProductDetail extends PublicCatalogCard {
  description: string;
  deliveryMode: PublicCatalogDeliveryMode;
  variants: PublicCatalogVariant[];
  gallery: PublicCatalogGalleryImage[];
  serviceDetails: PublicCatalogServiceDetails | null;
}

export interface PublicCatalogListResponse {
  items: PublicCatalogCard[];
  pagination: { page: number; limit: number; hasNext: boolean };
}

export interface PublicCatalogListParams {
  categorySlug?: string;
  subcategorySlug?: string;
  productType?: PublicCatalogProductType;
  sort: PublicCatalogSort;
  page: number;
  limit: number;
}
