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
    apiFetch.mockResolvedValueOnce({ items: [], nextCursor: null });
    await expect(
      sellerOnboardingService.adminList({ status: "submitted", limit: 20 }),
    ).resolves.toEqual({ items: [], nextCursor: null });
  });
});
