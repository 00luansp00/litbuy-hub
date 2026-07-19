import { describe, expect, it } from "vitest";
import {
  parseAdminListingDraftDetail,
  parseAdminListingDraftSummary,
  parseListingDraft,
  parseSellerListingDraftDetail,
  parseSellerListingDraftSummary,
} from "@/services/listingDraftApiService";
import {
  apiAccountDetailsToForm,
  apiServiceDetailsToForm,
  apiVariantToFormVariant,
  formAccountDetailsToApi,
  formServiceDetailsToApi,
  formStateToDraftPayload,
  formVariantToApiVariant,
  sellerDraftDetailToFormState,
} from "@/components/seller-dashboard/listing-wizard/listingDraftFormAdapters";

const base = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  model: "NORMAL",
  title: null,
  category: null,
  subcategory: null,
  categoryId: null,
  subcategoryId: null,
  productType: null,
  price: "10.00",
  stock: 1,
  deliveryMode: "MANUAL",
  requestedPromotionTier: "SILVER",
  requestedSellerPlan: "STANDARD",
  autoMessage: null,
  notifications: {
    inApp: true,
    browser: false,
    emailFuture: false,
    externalIntegrationFuture: false,
  },
  wizardStep: 1,
  version: 1,
  submittedAt: null,
  updatedAt: new Date(0).toISOString(),
  rejectionCode: null,
  rejectionReason: null,
  variants: [],
  attributes: [],
  serviceDetails: null,
  accountDetails: null,
};
const seller = {
  id: "22222222-2222-4222-8222-222222222222",
  storeName: "Loja",
  slug: "loja",
  status: "ACTIVE",
  verified: false,
};
const adminMeta = {
  seller,
  reviewer: null,
  reviewStartedAt: null,
  reviewedAt: null,
  approvedAt: null,
};

describe("listing draft response parser", () => {
  it("accepts seller/admin summary and detail contracts separately", () => {
    expect(parseSellerListingDraftSummary(base).id).toBe(base.id);
    expect(parseSellerListingDraftDetail(base).deliveryMode).toBe("MANUAL");
    expect(parseAdminListingDraftSummary({ ...base, ...adminMeta }).seller.storeName).toBe("Loja");
    expect(parseAdminListingDraftDetail({ ...base, ...adminMeta }).seller.slug).toBe("loja");
  });

  it("accepts valid draft", () => {
    expect(parseListingDraft(base).id).toBe(base.id);
  });

  it("rejects malformed core fields", () => {
    expect(() => parseListingDraft({ ...base, id: "bad" })).toThrow(
      /Resposta de rascunho inválida/,
    );
    expect(() => parseListingDraft({ ...base, status: "ACTIVE" })).toThrow(
      /Resposta de rascunho inválida/,
    );
    expect(() => parseListingDraft({ ...base, price: "10" })).toThrow(
      /Resposta de rascunho inválida/,
    );
    expect(() => parseListingDraft({ ...base, version: 0 })).toThrow(
      /Resposta de rascunho inválida/,
    );
    expect(() => parseListingDraft({ ...base, updatedAt: "2026-01-01" })).toThrow(
      /Resposta de rascunho inválida/,
    );
  });

  it("maps variants and visual/API enums explicitly", () => {
    const api = {
      id: "33333333-3333-4333-8333-333333333333",
      title: "Pacote",
      description: null,
      price: "12.50",
      stock: 2,
      status: "PAUSED" as const,
      sortOrder: 3,
    };
    expect(apiVariantToFormVariant(api)).toMatchObject({ status: "paused", price: 12.5 });
    expect(
      formVariantToApiVariant(
        { id: "local", title: "Pacote", price: 12.5, stock: 2, status: "active" },
        0,
      ),
    ).toMatchObject({ status: "ACTIVE", price: "12.50", sortOrder: 0 });
  });

  it("maps service, account and notification payloads without lowercase API enums", () => {
    expect(
      apiServiceDetailsToForm({
        title: "S",
        description: null,
        pricingType: "QUOTE",
        basePrice: null,
        estimatedDelivery: "3 dias",
        buyerRequirements: null,
        notes: null,
      }).pricingType,
    ).toBe("quote");
    expect(
      formServiceDetailsToApi({ title: "S", pricingType: "quote", basePrice: 99 }).basePrice,
    ).toBeNull();
    expect(
      apiAccountDetailsToForm({
        provenance: "ORIGINAL_OWNER",
        recoveryLevel: "FULL",
        emailVerified: true,
        phoneLinked: false,
        documentLinked: false,
        fullAccess: true,
        recoveryRisk: "LOW",
        warrantyNote: null,
      }),
    ).toMatchObject({ provenance: "original_owner", recoveryLevel: "full", recoveryRisk: "low" });
    expect(
      formAccountDetailsToApi({
        provenance: "third_party",
        recoveryLevel: "unknown",
        recoveryRisk: "high",
        warrantyNote: "sem dados reais",
      }),
    ).toMatchObject({ provenance: "THIRD_PARTY", recoveryLevel: "UNKNOWN", recoveryRisk: "HIGH" });
  });

  it("converts detail to form state and payload by model", () => {
    const form = sellerDraftDetailToFormState({
      ...base,
      model: "DYNAMIC",
      price: null,
      stock: null,
      requestedPromotionTier: "DIAMOND",
      requestedSellerPlan: "LIT_MAX",
      variants: [
        {
          id: "33333333-3333-4333-8333-333333333333",
          title: "V",
          description: null,
          price: "9.90",
          stock: 1,
          status: "ACTIVE",
          sortOrder: 0,
        },
      ],
    });
    expect(form.model).toBe("dynamic");
    expect(form.promotionTier).toBe("diamond");
    const payload = formStateToDraftPayload(form);
    expect(payload.model).toBe("DYNAMIC");
    expect(payload.price).toBeNull();
    expect(payload.variants?.[0].status).toBe("ACTIVE");
  });
});
