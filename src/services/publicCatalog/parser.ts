import type {
  PublicCatalogCard,
  PublicCatalogGalleryImage,
  PublicCatalogListResponse,
  PublicCatalogModel,
  PublicCatalogPricing,
  PublicCatalogProductType,
  PublicCatalogProductDetail,
  PublicCatalogServiceDetails,
  PublicCatalogVariant,
} from "./types";

export const MALFORMED_PUBLIC_CATALOG_RESPONSE = "MALFORMED_PUBLIC_CATALOG_RESPONSE";

const productTypes = new Set<PublicCatalogProductType>([
  "ACCOUNT",
  "VIRTUAL_CURRENCY",
  "GIFT_CARD",
  "KEY",
  "SKIN",
  "ITEM",
  "SERVICE",
  "SUBSCRIPTION",
  "GAME",
  "SOFTWARE",
  "OTHER",
]);
const models = new Set<PublicCatalogModel>(["NORMAL", "DYNAMIC", "SERVICE"]);
const decimal = /^(?:0|[1-9]\d*)(?:\.\d+)?$/;

function malformed(): never {
  throw new Error(MALFORMED_PUBLIC_CATALOG_RESPONSE);
}
function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) malformed();
  return value as Record<string, unknown>;
}
function text(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) malformed();
  return value;
}
function nullableText(value: unknown): string | null {
  if (value === null) return null;
  return text(value);
}
function namedSlug(value: unknown) {
  const item = record(value);
  return { slug: text(item.slug), name: text(item.name) };
}
function pricing(value: unknown): PublicCatalogPricing {
  const item = record(value);
  if (item.kind === "QUOTE") {
    if (item.amount !== null) malformed();
    return { kind: "QUOTE", amount: null };
  }
  if (
    (item.kind === "FIXED" || item.kind === "FROM") &&
    typeof item.amount === "string" &&
    decimal.test(item.amount)
  ) {
    return { kind: item.kind, amount: item.amount };
  }
  return malformed();
}
function card(value: unknown): PublicCatalogCard {
  const item = record(value);
  if (
    typeof item.productType !== "string" ||
    !productTypes.has(item.productType as PublicCatalogProductType)
  )
    malformed();
  if (typeof item.model !== "string" || !models.has(item.model as PublicCatalogModel)) malformed();
  if (
    item.stock !== null &&
    (typeof item.stock !== "number" || !Number.isInteger(item.stock) || item.stock < 0)
  )
    malformed();
  const seller = record(item.seller);
  const image = record(item.coverImage);
  const url = text(image.url);
  const expiresAt = text(image.expiresAt);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") malformed();
  } catch {
    malformed();
  }
  if (Number.isNaN(Date.parse(expiresAt))) malformed();
  const parsedPricing = pricing(item.pricing);
  if (
    (item.model === "NORMAL" && parsedPricing.kind !== "FIXED") ||
    (item.model === "DYNAMIC" && parsedPricing.kind !== "FROM") ||
    (item.model === "SERVICE" && parsedPricing.kind === "FROM")
  )
    malformed();
  return {
    id: text(item.id),
    slug: text(item.slug),
    title: text(item.title),
    shortDescription: text(item.shortDescription),
    productType: item.productType as PublicCatalogProductType,
    model: item.model as PublicCatalogModel,
    pricing: parsedPricing,
    stock: item.stock as number | null,
    category: namedSlug(item.category),
    subcategory: item.subcategory === null ? null : namedSlug(item.subcategory),
    seller: { slug: text(seller.slug), storeName: text(seller.storeName) },
    coverImage: { url, expiresAt, altText: nullableText(image.altText) },
  };
}

function variant(value: unknown): PublicCatalogVariant {
  const item = record(value);
  if (!decimal.test(typeof item.price === "string" ? item.price : "")) malformed();
  if (!Number.isSafeInteger(item.stock) || (item.stock as number) < 0) malformed();
  return {
    id: text(item.id),
    title: text(item.title),
    description: nullableText(item.description),
    price: item.price as string,
    stock: item.stock as number,
  };
}

function galleryImage(value: unknown): PublicCatalogGalleryImage {
  const item = record(value);
  if ("objectKey" in item || typeof item.isCover !== "boolean") malformed();
  const url = text(item.url);
  const expiresAt = text(item.expiresAt);
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") malformed();
  } catch {
    malformed();
  }
  if (Number.isNaN(Date.parse(expiresAt))) malformed();
  return {
    id: text(item.id),
    url,
    expiresAt,
    altText: nullableText(item.altText),
    isCover: item.isCover,
  };
}

function serviceDetails(
  value: unknown,
  common: PublicCatalogCard,
): PublicCatalogServiceDetails | null {
  if (common.model !== "SERVICE") {
    if (value !== null) malformed();
    return null;
  }
  const item = record(value);
  const estimatedDelivery = text(item.estimatedDelivery);
  if (item.pricingType === "FIXED") {
    if (
      typeof item.basePrice !== "string" ||
      !decimal.test(item.basePrice) ||
      common.pricing.kind !== "FIXED" ||
      common.pricing.amount !== item.basePrice
    )
      malformed();
    return { pricingType: "FIXED", basePrice: item.basePrice, estimatedDelivery };
  }
  if (
    item.pricingType === "QUOTE" &&
    item.basePrice === null &&
    common.pricing.kind === "QUOTE" &&
    common.pricing.amount === null
  )
    return { pricingType: "QUOTE", basePrice: null, estimatedDelivery };
  return malformed();
}

export function parsePublicCatalogDetailResponse(raw: unknown): PublicCatalogProductDetail {
  const root = record(raw);
  const common = card(root);
  if (root.deliveryMode !== "MANUAL" && root.deliveryMode !== "AUTOMATIC") malformed();
  if (!Array.isArray(root.variants) || !Array.isArray(root.gallery) || root.gallery.length === 0)
    malformed();
  const variants = root.variants.map(variant);
  if (common.model === "DYNAMIC" && variants.length === 0) malformed();
  if (new Set(variants.map((item) => item.id)).size !== variants.length) malformed();
  const gallery = root.gallery.map(galleryImage);
  if (
    new Set(gallery.map((item) => item.id)).size !== gallery.length ||
    new Set(gallery.map((item) => item.url)).size !== gallery.length
  )
    malformed();
  const covers = gallery.filter((item) => item.isCover);
  if (covers.length !== 1) malformed();
  const cover = covers[0];
  if (
    cover.url !== common.coverImage.url ||
    cover.expiresAt !== common.coverImage.expiresAt ||
    cover.altText !== common.coverImage.altText
  )
    malformed();
  return {
    ...common,
    description: text(root.description),
    deliveryMode: root.deliveryMode,
    variants,
    gallery,
    serviceDetails: serviceDetails(root.serviceDetails, common),
  };
}

export function parsePublicCatalogListResponse(raw: unknown): PublicCatalogListResponse {
  const root = record(raw);
  if (!Array.isArray(root.items)) malformed();
  const pagination = record(root.pagination);
  if (
    typeof pagination.page !== "number" ||
    !Number.isInteger(pagination.page) ||
    pagination.page < 1 ||
    typeof pagination.limit !== "number" ||
    !Number.isInteger(pagination.limit) ||
    pagination.limit < 1 ||
    typeof pagination.hasNext !== "boolean"
  )
    malformed();
  return {
    items: root.items.map(card),
    pagination: { page: pagination.page, limit: pagination.limit, hasNext: pagination.hasNext },
  };
}
