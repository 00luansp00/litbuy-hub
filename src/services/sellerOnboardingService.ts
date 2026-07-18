import { ApiError, apiFetch } from "@/lib/api/client";

export type SellerApplicationStatus =
  | "draft"
  | "submitted"
  | "under_review"
  | "approved"
  | "rejected";
export type SellerApplication = {
  id: string;
  storeName: string;
  requestedSlug: string;
  description: string | null;
  status: SellerApplicationStatus;
  submittedAt: string | null;
  rejectionCode: string | null;
  rejectionReason: string | null;
};
export type SellerProfile = {
  id: string;
  storeName: string;
  slug: string;
  description: string | null;
  status: "active" | "suspended" | "closed";
  verified: boolean;
};
export type SellerRequirements = {
  emailVerified: boolean;
  phoneVerified: boolean;
  ageEligible: boolean;
  accountActive?: boolean;
  sellerAgreementVersion: string;
  sellerAgreementAccepted: boolean;
  sellerAgreementCurrent: boolean;
};
export type SellerOnboardingMe = {
  application: SellerApplication | null;
  sellerProfile: SellerProfile | null;
  requirements: SellerRequirements;
};
export type SellerApplicationPayload = {
  storeName: string;
  requestedSlug: string;
  description?: string;
  sellerAgreementAccepted: boolean;
};
export type AdminSellerApplication = SellerApplication & { requirements: SellerRequirements };
export type AdminSellerApplicationsPage = {
  items: AdminSellerApplication[];
  nextCursor: string | null;
};
export type RejectSellerApplicationPayload = { code: string; reason?: string };

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = new Set(["draft", "submitted", "under_review", "approved", "rejected"]);
const profileStatuses = new Set(["active", "suspended", "closed"]);
function malformed(): never {
  throw new ApiError(502, "SELLER_ONBOARDING_RESPONSE_INVALID", "Resposta de onboarding inválida.");
}
function obj(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== "object" || Array.isArray(v)) malformed();
  return v as Record<string, unknown>;
}
function str(v: unknown): string {
  if (typeof v !== "string") malformed();
  return v;
}
function nullableStr(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  return str(v);
}
function bool(v: unknown): boolean {
  if (typeof v !== "boolean") malformed();
  return v;
}
function isoOrNull(v: unknown): string | null {
  const s = nullableStr(v);
  if (s !== null && Number.isNaN(Date.parse(s))) malformed();
  return s;
}
function app(v: unknown): SellerApplication | null {
  if (v === null) return null;
  const o = obj(v);
  const status = str(o.status);
  if (!statuses.has(status)) malformed();
  const id = str(o.id);
  if (!uuid.test(id)) malformed();
  return {
    id,
    storeName: str(o.storeName),
    requestedSlug: str(o.requestedSlug),
    description: nullableStr(o.description),
    status: status as SellerApplicationStatus,
    submittedAt: isoOrNull(o.submittedAt),
    rejectionCode: nullableStr(o.rejectionCode),
    rejectionReason: nullableStr(o.rejectionReason),
  };
}
function profile(v: unknown): SellerProfile | null {
  if (v === null) return null;
  const o = obj(v);
  const id = str(o.id);
  if (!uuid.test(id)) malformed();
  const status = str(o.status);
  if (!profileStatuses.has(status)) malformed();
  return {
    id,
    storeName: str(o.storeName),
    slug: str(o.slug),
    description: nullableStr(o.description),
    status: status as SellerProfile["status"],
    verified: bool(o.verified),
  };
}
function requirements(v: unknown): SellerRequirements {
  const o = obj(v);
  return {
    emailVerified: bool(o.emailVerified),
    phoneVerified: bool(o.phoneVerified),
    ageEligible: bool(o.ageEligible),
    accountActive: typeof o.accountActive === "boolean" ? o.accountActive : undefined,
    sellerAgreementVersion: str(o.sellerAgreementVersion),
    sellerAgreementAccepted: bool(o.sellerAgreementAccepted),
    sellerAgreementCurrent: bool(o.sellerAgreementCurrent),
  };
}
function me(v: unknown): SellerOnboardingMe {
  const o = obj(v);
  return {
    application: app(o.application),
    sellerProfile: profile(o.sellerProfile),
    requirements: requirements(o.requirements),
  };
}
function adminItem(v: unknown): AdminSellerApplication {
  const o = obj(v);
  return { ...app(o)!, requirements: requirements(o.requirements) };
}
function page(v: unknown): AdminSellerApplicationsPage {
  const o = obj(v);
  if (!Array.isArray(o.items)) malformed();
  const nextCursor = o.nextCursor === null ? null : str(o.nextCursor);
  if (nextCursor !== null && !uuid.test(nextCursor)) malformed();
  return { items: o.items.map(adminItem), nextCursor };
}
function availability(v: unknown) {
  const o = obj(v);
  return { slug: str(o.slug), available: bool(o.available) };
}

export const sellerOnboardingService = {
  me: async () => me(await apiFetch<unknown>("/seller-onboarding/me")),
  saveDraft: async (payload: SellerApplicationPayload) =>
    app(
      await apiFetch<unknown>("/seller-onboarding/application", {
        method: "PUT",
        body: JSON.stringify(payload),
      }),
    )!,
  submit: async () =>
    app(await apiFetch<unknown>("/seller-onboarding/application/submit", { method: "POST" }))!,
  slugAvailability: async (slug: string) =>
    availability(
      await apiFetch<unknown>(
        `/seller-onboarding/slug-availability?slug=${encodeURIComponent(slug)}`,
      ),
    ),
  adminList: async (
    params: { status?: string; search?: string; limit?: number; cursor?: string } = {},
  ) => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.search) qs.set("search", params.search);
    if (params.limit) qs.set("limit", String(params.limit));
    if (params.cursor) qs.set("cursor", params.cursor);
    return page(await apiFetch<unknown>(`/admin/seller-applications${qs.size ? `?${qs}` : ""}`));
  },
  adminStartReview: async (id: string) =>
    app(
      await apiFetch<unknown>(`/admin/seller-applications/${id}/start-review`, { method: "POST" }),
    )!,
  adminApprove: async (id: string) =>
    app(await apiFetch<unknown>(`/admin/seller-applications/${id}/approve`, { method: "POST" }))!,
  adminReject: async (id: string, payload: RejectSellerApplicationPayload) =>
    app(
      await apiFetch<unknown>(`/admin/seller-applications/${id}/reject`, {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    )!,
};
