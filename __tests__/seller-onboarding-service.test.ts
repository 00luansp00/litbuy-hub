import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";

const { apiFetch } = vi.hoisted(() => ({ apiFetch: vi.fn() }));
vi.mock("@/lib/api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/client")>()),
  apiFetch,
}));

const validMe = {
  application: null,
  sellerProfile: null,
  commercialEnabled: false,
  requirements: {
    emailVerified: true,
    phoneVerified: true,
    ageEligible: true,
    accountActive: true,
    sellerAgreementVersion: "2026-test",
    sellerAgreementAccepted: false,
    sellerAgreementCurrent: false,
  },
};

const validApplication = {
  id: "11111111-1111-4111-8111-111111111111",
  storeName: "Loja",
  requestedSlug: "loja",
  description: null,
  status: "under_review",
  submittedAt: "2026-08-12T12:00:00.000Z",
  rejectionCode: null,
  rejectionReason: null,
};

describe("sellerOnboardingService defensive parser", () => {
  beforeEach(() => {
    apiFetch.mockReset();
  });
  it("parses valid me response", async () => {
    apiFetch.mockResolvedValueOnce(validMe);
    const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
    await expect(sellerOnboardingService.me()).resolves.toEqual(validMe);
  });
  it("rejects unknown statuses and malformed requirements", async () => {
    const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
    apiFetch.mockResolvedValueOnce({
      ...validMe,
      application: {
        id: "11111111-1111-4111-8111-111111111111",
        storeName: "Loja",
        requestedSlug: "loja",
        status: "owned",
        submittedAt: null,
        rejectionCode: null,
        rejectionReason: null,
      },
    });
    await expect(sellerOnboardingService.me()).rejects.toMatchObject({
      code: "SELLER_ONBOARDING_RESPONSE_INVALID",
    });
    apiFetch.mockResolvedValueOnce({
      application: null,
      sellerProfile: null,
      requirements: { emailVerified: true },
    });
    await expect(sellerOnboardingService.me()).rejects.toBeInstanceOf(ApiError);
  });
  it("does not create privileges from invalid approval payload", async () => {
    const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
    apiFetch.mockResolvedValueOnce({
      id: "11111111-1111-4111-8111-111111111111",
      storeName: "Loja",
      requestedSlug: "loja",
      status: "approved",
      submittedAt: "not-a-date",
      rejectionCode: null,
      rejectionReason: null,
    });
    await expect(
      sellerOnboardingService.adminApprove("11111111-1111-4111-8111-111111111111"),
    ).rejects.toMatchObject({ code: "SELLER_ONBOARDING_RESPONSE_INVALID" });
  });
  it("parses admin pagination", async () => {
    const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
    apiFetch.mockResolvedValueOnce({
      items: [],
      nextCursor: "11111111-1111-4111-8111-111111111111",
    });
    await expect(
      sellerOnboardingService.adminList({ status: "submitted", limit: 20 }),
    ).resolves.toEqual({ items: [], nextCursor: "11111111-1111-4111-8111-111111111111" });
  });
  it("uses application identity only in admin paths and sends the rejection decision", async () => {
    const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
    apiFetch.mockResolvedValue(validApplication);

    await sellerOnboardingService.adminStartReview(validApplication.id);
    await sellerOnboardingService.adminApprove(validApplication.id);
    await sellerOnboardingService.adminReject(validApplication.id, {
      code: "INCOMPLETE_INFORMATION",
      reason: "Envie os dados obrigatorios.",
    });

    expect(apiFetch).toHaveBeenNthCalledWith(
      1,
      `/admin/seller-applications/${validApplication.id}/start-review`,
      { method: "POST" },
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      2,
      `/admin/seller-applications/${validApplication.id}/approve`,
      { method: "POST" },
    );
    expect(apiFetch).toHaveBeenNthCalledWith(
      3,
      `/admin/seller-applications/${validApplication.id}/reject`,
      {
        method: "POST",
        body: JSON.stringify({
          code: "INCOMPLETE_INFORMATION",
          reason: "Envie os dados obrigatorios.",
        }),
      },
    );
  });
});

it("rejects malformed admin nextCursor", async () => {
  const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
  apiFetch.mockResolvedValueOnce({ items: [], nextCursor: "qualquer-coisa" });
  await expect(sellerOnboardingService.adminList()).rejects.toMatchObject({
    code: "SELLER_ONBOARDING_RESPONSE_INVALID",
  });
});

it("parses admin item with current agreement requirements", async () => {
  const { sellerOnboardingService } = await import("@/services/sellerOnboardingService");
  apiFetch.mockResolvedValueOnce({
    items: [
      {
        id: "11111111-1111-4111-8111-111111111111",
        storeName: "Loja",
        requestedSlug: "loja",
        description: null,
        status: "submitted",
        submittedAt: null,
        rejectionCode: null,
        rejectionReason: null,
        requirements: {
          emailVerified: true,
          phoneVerified: true,
          ageEligible: true,
          sellerAgreementVersion: "2026-test",
          sellerAgreementAccepted: true,
          sellerAgreementCurrent: true,
        },
      },
    ],
    nextCursor: null,
  });
  await expect(sellerOnboardingService.adminList()).resolves.toMatchObject({
    items: [{ requirements: { sellerAgreementCurrent: true } }],
  });
});
