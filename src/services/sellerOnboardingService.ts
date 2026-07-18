import { apiFetch } from "@/lib/api/client";

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
  description?: string | null;
  status: SellerApplicationStatus;
  submittedAt?: string | null;
  rejectionCode?: string | null;
  rejectionReason?: string | null;
};
export type SellerProfile = {
  id: string;
  storeName: string;
  slug: string;
  description?: string | null;
  status: "active" | "suspended" | "closed";
  verified: boolean;
};
export type SellerRequirements = {
  emailVerified: boolean;
  phoneVerified: boolean;
  ageEligible: boolean;
  accountActive?: boolean;
  sellerAgreementVersion: string;
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
export type RejectSellerApplicationPayload = { code: string; reason?: string };

export const sellerOnboardingService = {
  me: () => apiFetch<SellerOnboardingMe>("/seller-onboarding/me"),
  saveDraft: (payload: SellerApplicationPayload) =>
    apiFetch<SellerApplication>("/seller-onboarding/application", {
      method: "PUT",
      body: JSON.stringify(payload),
    }),
  submit: () =>
    apiFetch<SellerApplication>("/seller-onboarding/application/submit", { method: "POST" }),
  slugAvailability: (slug: string) =>
    apiFetch<{ slug: string; available: boolean }>(
      `/seller-onboarding/slug-availability?slug=${encodeURIComponent(slug)}`,
    ),
  adminList: (params: { status?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.status && params.status !== "all") qs.set("status", params.status);
    if (params.search) qs.set("search", params.search);
    return apiFetch<{ items: AdminSellerApplication[] }>(
      `/admin/seller-applications${qs.size ? `?${qs}` : ""}`,
    );
  },
  adminStartReview: (id: string) =>
    apiFetch<SellerApplication>(`/admin/seller-applications/${id}/start-review`, {
      method: "POST",
    }),
  adminApprove: (id: string) =>
    apiFetch<SellerApplication>(`/admin/seller-applications/${id}/approve`, { method: "POST" }),
  adminReject: (id: string, payload: RejectSellerApplicationPayload) =>
    apiFetch<SellerApplication>(`/admin/seller-applications/${id}/reject`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};
