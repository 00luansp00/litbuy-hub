import { apiFetch, ApiError } from "@/lib/api/client";
import type {
  ListingDeliveryMode,
  ListingModel,
  ListingProductType,
  ListingServicePricingType,
} from "@/types";

export type ListingDraftStatus =
  | "DRAFT"
  | "PENDING_REVIEW"
  | "UNDER_REVIEW"
  | "REJECTED"
  | "APPROVED";
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
  serviceDetails: any;
  accountDetails: any;
  seller?: { storeName: string; slug: string; status: string; verified: boolean };
  moderationNotice?: string;
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
export function parseListingDraft(raw: unknown): ListingDraftRecord {
  const r = raw as any;
  if (
    !r ||
    typeof r !== "object" ||
    !uuid.test(r.id) ||
    !isStatus(r.status) ||
    typeof r.version !== "number" ||
    r.version < 1 ||
    typeof r.updatedAt !== "string"
  )
    invalid();
  if (r.price !== null && !dec.test(r.price)) invalid();
  if (!Array.isArray(r.variants) || !Array.isArray(r.attributes)) invalid();
  return r as ListingDraftRecord;
}
function page(raw: unknown): ListingDraftPage {
  const r = raw as any;
  if (!r || !Array.isArray(r.items) || (r.nextCursor !== null && typeof r.nextCursor !== "string"))
    invalid();
  return { items: r.items.map(parseListingDraft), nextCursor: r.nextCursor };
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
  };
  accountDetails: null | Record<string, unknown>;
}>;
export const listingDraftApiService = {
  list: (q: Record<string, string | number | undefined> = {}) =>
    pageFetch("/seller/listing-drafts", q),
  adminList: (q: Record<string, string | number | undefined> = {}) =>
    pageFetch("/admin/listing-drafts", q),
  get: (id: string) => apiFetch<unknown>(`/seller/listing-drafts/${id}`).then(parseListingDraft),
  adminGet: (id: string) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}`).then(parseListingDraft),
  create: (payload: DraftPayload) =>
    apiFetch<unknown>("/seller/listing-drafts", {
      method: "POST",
      body: JSON.stringify(payload),
    }).then(parseListingDraft),
  update: (id: string, expectedVersion: number, payload: DraftPayload) =>
    apiFetch<unknown>(`/seller/listing-drafts/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ ...payload, expectedVersion }),
    }).then(parseListingDraft),
  submit: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/seller/listing-drafts/${id}/submit`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseListingDraft),
  startReview: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/start-review`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseListingDraft),
  approve: (id: string, expectedVersion: number) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/approve`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion }),
    }).then(parseListingDraft),
  reject: (id: string, expectedVersion: number, rejectionCode: string, rejectionReason: string) =>
    apiFetch<unknown>(`/admin/listing-drafts/${id}/reject`, {
      method: "POST",
      body: JSON.stringify({ expectedVersion, rejectionCode, rejectionReason }),
    }).then(parseListingDraft),
};
function pageFetch(path: string, q: Record<string, string | number | undefined>) {
  const params = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== "") params.set(k, String(v));
  });
  return apiFetch<unknown>(`${path}${params.size ? `?${params}` : ""}`).then(page);
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
