import type {
  PublicCatalogCard,
  PublicCatalogListResponse,
  PublicCatalogModel,
  PublicCatalogPricing,
  PublicCatalogProductType,
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
  return {
    id: text(item.id),
    slug: text(item.slug),
    title: text(item.title),
    shortDescription: text(item.shortDescription),
    productType: item.productType as PublicCatalogProductType,
    model: item.model as PublicCatalogModel,
    pricing: pricing(item.pricing),
    stock: item.stock as number | null,
    category: namedSlug(item.category),
    subcategory: item.subcategory === null ? null : namedSlug(item.subcategory),
    seller: { slug: text(seller.slug), storeName: text(seller.storeName) },
    coverImage: { url, expiresAt, altText: nullableText(image.altText) },
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
