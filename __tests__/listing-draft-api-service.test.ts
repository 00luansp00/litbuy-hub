import { describe, expect, it } from "vitest";
import { parseListingDraft } from "@/services/listingDraftApiService";
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
  updatedAt: new Date().toISOString(),
  rejectionCode: null,
  rejectionReason: null,
  variants: [],
  attributes: [],
  serviceDetails: null,
  accountDetails: null,
};
describe("listing draft response parser", () => {
  it("accepts valid draft", () => {
    expect(parseListingDraft(base).id).toBe(base.id);
  });
  it("rejects invalid uuid", () => {
    expect(() => parseListingDraft({ ...base, id: "bad" })).toThrow(
      /Resposta de rascunho inválida/,
    );
  });
  it("rejects invalid status", () => {
    expect(() => parseListingDraft({ ...base, status: "ACTIVE" })).toThrow(
      /Resposta de rascunho inválida/,
    );
  });
  it("rejects invalid decimal", () => {
    expect(() => parseListingDraft({ ...base, price: "10" })).toThrow(
      /Resposta de rascunho inválida/,
    );
  });
  it("rejects invalid version", () => {
    expect(() => parseListingDraft({ ...base, version: 0 })).toThrow(
      /Resposta de rascunho inválida/,
    );
  });
});
