import { apiFetch, ApiError } from "@/lib/api/client";
import type { ListingDeliveryMode, ListingModel, ListingProductType } from "@/types";

export type ListingDraftStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED";
export type MaterializedProductReference = {
  id: string;
  slug: string;
  status: "UNPUBLISHED" | "ACTIVE" | "PAUSED" | "REMOVED";
};
export type ListingDraftRecord = {
  id: string;
  status: ListingDraftStatus;
  model: Uppercase<ListingModel>;
  title: string | null;
  description?: string | null;
  category: { id: string; slug: string; name: string } | null;
  subcategory: { id: string; slug: string; name: string } | null;
  categoryId: string | null;
  subcategoryId: string | null;
  productType: ListingProductType | null;
  price: string | null;
  stock: number | null;
  deliveryMode: Uppercase<ListingDeliveryMode>;
  requestedPromotionTier: "SILVER" | "GOLD" | "DIAMOND";
  requestedSellerPlan: "STANDARD" | "LIT_MAX";
  autoMessage: string | null;
  notifications: {
    inApp: boolean;
    browser: boolean;
    emailFuture: boolean;
    externalIntegrationFuture: boolean;
  };
  wizardStep: number;
  version: number;
  submittedAt: string | null;
  updatedAt: string;
  rejectionCode: string | null;
  rejectionReason: string | null;
  variants: {
    id: string;
    title: string;
    description: string | null;
    price: string;
    stock: number;
    status: "ACTIVE" | "PAUSED";
    sortOrder: number;
  }[];
  attributes: { key: string; value: string }[];
  serviceDetails: ListingDraftServiceDetails | null;
  accountDetails: ListingDraftAccountDetails | null;
  reviewer?: { id: string } | null;
  seller?: {
    id?: string;
    storeName: string;
    slug: string;
    status: string;
    verified: boolean;
  } | null;
  materializedProduct: MaterializedProductReference | null;
  moderationNotice?: string;
};

export type ListingDraftServiceDetails = {
  title: string | null;
  description: string | null;
  pricingType: "FIXED" | "QUOTE" | null;
  basePrice: string | null;
  estimatedDelivery: string | null;
  buyerRequirements: string | null;
  notes: string | null;
};
export type ListingDraftAccountDetails = {
  provenance: string | null;
  recoveryLevel: string | null;
  emailVerified: boolean | null;
  phoneLinked: boolean | null;
  documentLinked: boolean | null;
  fullAccess: boolean | null;
  recoveryRisk: string | null;
  warrantyNote: string | null;
};
export type SellerListingDraftSummary = Pick<
  ListingDraftRecord,
  | "id"
  | "status"
  | "model"
  | "title"
  | "category"
  | "subcategory"
  | "productType"
  | "price"
  | "stock"
  | "wizardStep"
  | "version"
  | "submittedAt"
  | "updatedAt"
  | "rejectionCode"
  | "rejectionReason"
  | "moderationNotice"
  | "materializedProduct"
>;
export type AdminListingDraftSummary = SellerListingDraftSummary & {
  seller: NonNullable<ListingDraftRecord["seller"]>;
  reviewer: ListingDraftRecord["reviewer"];
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
};
export type SellerListingDraftDetail = ListingDraftRecord;
export type AdminListingDraftDetail = ListingDraftRecord & {
  seller: NonNullable<ListingDraftRecord["seller"]>;
  reviewer: ListingDraftRecord["reviewer"];
  reviewStartedAt: string | null;
  reviewedAt: string | null;
  approvedAt: string | null;
};
export type SellerListingDraftPage = {
  items: SellerListingDraftSummary[];
  nextCursor: string | null;
};
export type AdminListingDraftPage = {
  items: AdminListingDraftSummary[];
  nextCursor: string | null;
};
export type ListingDraftPage = { items: ListingDraftRecord[]; nextCursor: string | null };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const dec = /^[0-9]+\.[0-9]{2}$/;
function invalid(): never {
  throw new ApiError(502, "LISTING_DRAFT_RESPONSE_INVALID", "Resposta de rascunho inválida.");
}
function isStatus(v: unknown): v is ListingDraftStatus {
  return ["DRAFT", "PENDING_REVIEW", "UNDER_REVIEW", "REJECTED", "APPROVED"].includes(String(v));
}
const models = ["NORMAL", "DYNAMIC", "SERVICE"] as const;
const deliveries = ["MANUAL", "AUTOMATIC"] as const;
const promotions = ["SILVER", "GOLD", "DIAMOND"] as const;
const plans = ["STANDARD", "LIT_MAX"] as const;
const variantStatuses = ["ACTIVE", "PAUSED"] as const;
const productStatuses = ["UNPUBLISHED", "ACTIVE", "PAUSED", "REMOVED"] as const;
const productTypes = [
  "account",
  "virtual_currency",
  "gift_card",
  "key",
  "skin",
  "item",
  "service",
  "subscription",
  "game",
  "software",
  "other",
] as const;
const sellerStatuses = ["ACTIVE", "SUSPENDED", "PENDING", "REJECTED"] as const;
const provenances = ["ORIGINAL_OWNER", "RESELLER", "THIRD_PARTY", "OTHER"] as const;
const recoveryLevels = ["FULL", "PARTIAL", "NONE", "UNKNOWN"] as const;
const recoveryRisks = ["LOW", "MEDIUM", "HIGH"] as const;
function isObject(v: unknown): v is Record<string, unknown> {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}
function isEnum<T extends readonly string[]>(values: T, v: unknown): v is T[number] {
  return typeof v === "string" && values.includes(v);
}
function iso(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const d = new Date(v);
  return !Number.isNaN(d.getTime()) && d.toISOString() === v;
}
function nullableIso(v: unknown): string | null {
  if (v === null) return null;
  if (!iso(v)) invalid();
  return v;
}
function nullableString(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v !== "string") invalid();
  return v;
}
function parseCategory(v: unknown) {
  if (v === null) return null;
  if (
    !isObject(v) ||
    !uuid.test(String(v.id)) ||
    typeof v.slug !== "string" ||
    typeof v.name !== "string"
  )
    invalid();
  return { id: String(v.id), slug: v.slug, name: v.name };
}
function parseDecimal(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string" || !dec.test(v) || Number(v) <= 0) invalid();
  return v;
}
function parseProductType(v: unknown): ListingProductType | null {
  if (v === null) return null;
  if (!isEnum(productTypes, v)) invalid();
  return v as ListingProductType;
}
function parseMaterializedProduct(v: unknown): MaterializedProductReference | null {
  if (v === null || v === undefined) return null;
  if (
    !isObject(v) ||
    !uuid.test(String(v.id)) ||
    typeof v.slug !== "string" ||
    !isEnum(productStatuses, v.status)
  )
    invalid();
  return { id: String(v.id), slug: v.slug, status: v.status };
}
function parseAttributes(v: unknown): { key: string; value: string }[] {
  if (!Array.isArray(v)) invalid();
  const seen = new Set<string>();
  return v.map((a) => {
    if (!isObject(a) || typeof a.key !== "string" || typeof a.value !== "string") invalid();
    if (seen.has(a.key)) invalid();
    seen.add(a.key);
    return { key: a.key, value: a.value };
  });
}
function parseVariants(v: unknown): ListingDraftRecord["variants"] {
  if (!Array.isArray(v)) invalid();
  return v.map((raw) => {
    if (
      !isObject(raw) ||
      !uuid.test(String(raw.id)) ||
      typeof raw.title !== "string" ||
      !dec.test(String(raw.price)) ||
      Number(raw.price) <= 0 ||
      !Number.isInteger(raw.stock) ||
      !Number.isInteger(raw.sortOrder) ||
      !isEnum(variantStatuses, raw.status)
    )
      invalid();
    const stock = raw.stock as number;
    const sortOrder = raw.sortOrder as number;
    return {
      id: String(raw.id),
      title: raw.title,
      description: nullableString(raw.description),
      price: String(raw.price),
      stock,
      status: raw.status,
      sortOrder,
    };
  });
}
function parseServiceDetails(v: unknown): ListingDraftServiceDetails | null {
  if (v === null) return null;
  if (!isObject(v)) invalid();
  const pricing =
    v.pricingType === null
      ? null
      : isEnum(["FIXED", "QUOTE"] as const, v.pricingType)
        ? v.pricingType
        : invalid();
  return {
    title: nullableString(v.title),
    description: nullableString(v.description),
    pricingType: pricing,
    basePrice: parseDecimal(v.basePrice),
    estimatedDelivery: nullableString(v.estimatedDelivery),
    buyerRequirements: nullableString(v.buyerRequirements),
    notes: nullableString(v.notes),
  };
}
function parseAccountDetails(v: unknown): ListingDraftAccountDetails | null {
  if (v === null) return null;
  if (!isObject(v)) invalid();
  for (const key of ["emailVerified", "phoneLinked", "documentLinked", "fullAccess"] as const)
    if (v[key] !== null && typeof v[key] !== "boolean") invalid();
  const provenance =
    v.provenance === null ? null : isEnum(provenances, v.provenance) ? v.provenance : invalid();
  const recoveryLevel =
    v.recoveryLevel === null
      ? null
      : isEnum(recoveryLevels, v.recoveryLevel)
        ? v.recoveryLevel
        : invalid();
  const recoveryRisk =
    v.recoveryRisk === null
      ? null
      : isEnum(recoveryRisks, v.recoveryRisk)
        ? v.recoveryRisk
        : invalid();
  return {
    provenance,
    recoveryLevel,
    emailVerified: v.emailVerified as boolean | null,
    phoneLinked: v.phoneLinked as boolean | null,
    documentLinked: v.documentLinked as boolean | null,
    fullAccess: v.fullAccess as boolean | null,
    recoveryRisk,
    warrantyNote: nullableString(v.warrantyNote),
  };
}
function parseSellerSummaryFields(raw: unknown): SellerListingDraftSummary {
  if (!isObject(raw)) invalid();
  const version = raw.version;
  const wizardStep = raw.wizardStep;
  if (
    typeof raw.id !== "string" ||
    !uuid.test(raw.id) ||
    !isStatus(raw.status) ||
    !isEnum(models, raw.model) ||
    !Number.isInteger(version) ||
    (version as number) < 1 ||
    !Number.isInteger(wizardStep) ||
    (wizardStep as number) < 1 ||
    (wizardStep as number) > 6 ||
    !iso(raw.updatedAt)
  )
    invalid();
  const stockValue = raw.stock;
  const stock =
    stockValue === null
      ? null
      : Number.isInteger(stockValue) && (stockValue as number) >= 0
        ? (stockValue as number)
        : invalid();
  return {
    id: raw.id,
    status: raw.status,
    model: raw.model,
    title: nullableString(raw.title),
    category: parseCategory(raw.category),
    subcategory: parseCategory(raw.subcategory),
    productType: parseProductType(raw.productType),
    price: parseDecimal(raw.price),
    stock,
    wizardStep: wizardStep as number,
    version: version as number,
    submittedAt: nullableIso(raw.submittedAt),
    updatedAt: raw.updatedAt,
    rejectionCode: nullableString(raw.rejectionCode),
    rejectionReason: nullableString(raw.rejectionReason),
    materializedProduct: parseMaterializedProduct(raw.materializedProduct),
    moderationNotice:
      raw.moderationNotice === undefined
        ? undefined
        : (nullableString(raw.moderationNotice) ?? undefined),
  };
}
function parseSellerSummary(v: unknown) {
  if (
    v === null ||
    !isObject(v) ||
    typeof v.storeName !== "string" ||
    typeof v.slug !== "string" ||
    !isEnum(sellerStatuses, v.status) ||
    typeof v.verified !== "boolean" ||
    (v.id !== undefined && (typeof v.id !== "string" || !uuid.test(v.id)))
  )
    invalid();
  return {
    id: v.id as string | undefined,
    storeName: v.storeName,
    slug: v.slug,
    status: v.status,
    verified: v.verified,
  };
}
function parseReviewer(v: unknown) {
  if (v === undefined) return undefined;
  if (v === null) return null;
  if (!isObject(v) || typeof v.id !== "string" || !uuid.test(v.id)) invalid();
  return { id: v.id };
}
export function parseSellerListingDraftSummary(raw: unknown): SellerListingDraftSummary {
  return parseSellerSummaryFields(raw);
}
export function parseAdminListingDraftSummary(raw: unknown): AdminListingDraftSummary {
  if (!isObject(raw)) invalid();
  return {
    ...parseSellerSummaryFields(raw),
    seller: parseSellerSummary(raw.seller),
    reviewer: parseReviewer(raw.reviewer),
    reviewStartedAt: nullableIso(raw.reviewStartedAt),
    reviewedAt: nullableIso(raw.reviewedAt),
    approvedAt: nullableIso(raw.approvedAt),
  };
}
export function parseSellerListingDraftDetail(raw: unknown): SellerListingDraftDetail {
  if (!isObject(raw)) invalid();
  const summary = parseSellerSummaryFields(raw);
  if (raw.categoryId !== null && (typeof raw.categoryId !== "string" || !uuid.test(raw.categoryId)))
    invalid();
  if (
    raw.subcategoryId !== null &&
    (typeof raw.subcategoryId !== "string" || !uuid.test(raw.subcategoryId))
  )
    invalid();
  if (
    !isEnum(deliveries, raw.deliveryMode) ||
    !isEnum(promotions, raw.requestedPromotionTier) ||
    !isEnum(plans, raw.requestedSellerPlan)
  )
    invalid();
  const notifications = raw.notifications;
  if (
    !isObject(notifications) ||
    typeof notifications.inApp !== "boolean" ||
    typeof notifications.browser !== "boolean" ||
    typeof notifications.emailFuture !== "boolean" ||
    typeof notifications.externalIntegrationFuture !== "boolean"
  )
    invalid();
  return {
    ...summary,
    description: nullableString(raw.description),
    categoryId: raw.categoryId as string | null,
    subcategoryId: raw.subcategoryId as string | null,
    deliveryMode: raw.deliveryMode,
    requestedPromotionTier: raw.requestedPromotionTier,
    requestedSellerPlan: raw.requestedSellerPlan,
    autoMessage: nullableString(raw.autoMessage),
    notifications: {
      inApp: notifications.inApp,
      browser: notifications.browser,
      emailFuture: notifications.emailFuture,
      externalIntegrationFuture: notifications.externalIntegrationFuture,
    },
    variants: parseVariants(raw.variants),
    attributes: parseAttributes(raw.attributes),
    serviceDetails: parseServiceDetails(raw.serviceDetails),
    accountDetails: parseAccountDetails(raw.accountDetails),
    reviewer: parseReviewer(raw.reviewer),
    seller:
      raw.seller === undefined
        ? undefined
        : raw.seller === null
          ? null
          : parseSellerSummary(raw.seller),
  };
}
export function parseAdminListingDraftDetail(raw: unknown): AdminListingDraftDetail {
  if (!isObject(raw)) invalid();
  const detail = parseSellerListingDraftDetail(raw);
  return {
    ...detail,
    seller: parseSellerSummary(raw.seller),
    reviewer: parseReviewer(raw.reviewer),
    reviewStartedAt: nullableIso(raw.reviewStartedAt),
    reviewedAt: nullableIso(raw.reviewedAt),
    approvedAt: nullableIso(raw.approvedAt),
  };
}
export function parseListingDraft(raw: unknown): ListingDraftRecord {
  return parseSellerListingDraftDetail(raw);
}
function parseCursor(v: unknown): string | null {
  if (v === null) return null;
  if (typeof v !== "string" || v.length > 512) invalid();
  return v;
}
export function parseSellerListingDraftPage(raw: unknown): SellerListingDraftPage {
  if (!isObject(raw) || !Array.isArray(raw.items)) invalid();
  return {
    items: raw.items.map(parseSellerListingDraftSummary),
    nextCursor: parseCursor(raw.nextCursor),
  };
}
export function parseAdminListingDraftPage(raw: unknown): AdminListingDraftPage {
  if (!isObject(raw) || !Array.isArray(raw.items)) invalid();
  return {
    items: raw.items.map(parseAdminListingDraftSummary),
    nextCursor: parseCursor(raw.nextCursor),
  };
}
function page(raw: unknown): ListingDraftPage {
  const parsed = parseSellerListingDraftPage(raw);
  return { items: parsed.items as ListingDraftRecord[], nextCursor: parsed.nextCursor };
}
export type DraftPayload = Partial<{
  model: "NORMAL" | "DYNAMIC" | "SERVICE";
  categoryId: string | null;
  subcategoryId: string | null;
  productType: string | null;
  title: string | null;
  description: string | null;
  price: string | null;
  stock: number | null;
  deliveryMode: "MANUAL" | "AUTOMATIC";
  requestedPromotionTier: "SILVER" | "GOLD" | "DIAMOND";
  requestedSellerPlan: "STANDARD" | "LIT_MAX";
  autoMessage: string | null;
  wizardStep: number;
  attributes: { key: string; value: string }[];
  variants: {
    title: string;
    description?: string | null;
    price: string;
    stock: number;
    status?: "ACTIVE" | "PAUSED";
    sortOrder?: number;
  }[];
  serviceDetails: null | {
    title?: string | null;
    description?: string | null;
    pricingType?: "FIXED" | "QUOTE" | null;
    basePrice?: string | null;
    estimatedDelivery?: string | null;
    buyerRequirements?: string | null;
    notes?: string | null;
  };
  accountDetails: null | {
    provenance?: string | null;
    recoveryLevel?: string | null;
    emailVerified?: boolean | null;
    phoneLinked?: boolean | null;
    documentLinked?: boolean | null;
    fullAccess?: boolean | null;
    recoveryRisk?: string | null;
    warrantyNote?: string | null;
  };
}>;
export const listingDraftApiService = {
  list: (q: Record<string, string | number | undefined> = {}) =>
    pageFetch("/seller/listing-drafts", q, parseSellerListingDraftPage),
  adminList: (q: Record<string, string | number | undefined> = {}) =>
    pageFetch("/admin/listing-drafts", q, parseAdminListingDraftPage),
  get: (id: string) =>
    apiFetch<unknown>(`/seller/listing-drafts/${id}`).then(parseSellerListingDraftDetail),
  adminGet: (id: string) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}`).then(parseAdminListingDraftDetail),
  create: (payload: DraftPayload) =>
    apiFetch<unknown>("/seller/listing-drafts", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(parseSellerListingDraftDetail),
  update: (id: string, expectedVersion: number, payload: DraftPayload) =>
    apiFetch<unknown>(`/seller/listing-drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...payload, expectedVersion }),
    }).then(parseSellerListingDraftDetail),
  submit: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/seller/listing-drafts/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseSellerListingDraftDetail),
  startReview: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/start-review`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseAdminListingDraftDetail),
  approve: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseAdminListingDraftDetail),
  reject: (id: string, expectedVersion: number, rejectionCode: string, rejectionReason: string) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion, rejectionCode, rejectionReason }),
    }).then(parseAdminListingDraftDetail),
};
function pageFetch<T>(
  path: string,
  q: Record<string, string | number | undefined>,
  parser: (raw: unknown) => T,
) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  return apiFetch<unknown>(`${path}${params.size ? `?${params}` : ""}`).then(parser);
}
export const listingDraftStaticOptions = {
  models: [
    { id: "NORMAL", name: "Normal" },
    { id: "DYNAMIC", name: "Dinâmico" },
    { id: "SERVICE", name: "Serviço" },
  ],
  promotionTiers: ["SILVER", "GOLD", "DIAMOND"],
  sellerPlans: ["STANDARD", "LIT_MAX"],
} as const;
