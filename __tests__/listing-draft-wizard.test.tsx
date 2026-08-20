import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ListingDraftWizard } from "@/components/seller-dashboard/listing-wizard/ListingDraftWizard";

const { navigate, api, catalog, toast } = vi.hoisted(() => ({
  navigate: vi.fn(),
  api: { create: vi.fn(), update: vi.fn(), submit: vi.fn(), tierOptions: vi.fn() },
  catalog: {
    getCategories: vi.fn(),
    getProductTypes: vi.fn(),
    getSubcategoriesByCategory: vi.fn(),
    getAttributesForSubcategory: vi.fn(),
  },
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/listingDraftApiService", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/services/listingDraftApiService")>()),
  listingDraftApiService: api,
}));
vi.mock("@/services/catalogService", () => ({ catalogService: catalog }));
vi.mock("@/components/common/ImageUploader", () => ({
  ImageUploader: ({ onChange }: { onChange: (items: unknown[]) => void }) => (
    <button type="button" onClick={() => onChange([{ id: "local", previewUrl: "blob:local" }])}>
      adicionar preview local
    </button>
  ),
}));

const saved = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  model: "NORMAL",
  title: "Rascunho",
  description: "Descrição",
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

beforeEach(() => {
  vi.clearAllMocks();
  catalog.getCategories.mockResolvedValue([{ id: "cat", slug: "contas", name: "Contas" }]);
  catalog.getProductTypes.mockResolvedValue([
    { id: "account", name: "Conta" },
    { id: "service", name: "Serviço" },
  ]);
  catalog.getSubcategoriesByCategory.mockResolvedValue([
    { id: "sub", slug: "valorant", name: "Valorant" },
  ]);
  catalog.getAttributesForSubcategory.mockResolvedValue([
    { key: "rank", label: "Rank", type: "select", options: ["ouro"], required: true },
    { key: "level", label: "Level", type: "number" },
    { key: "verified", label: "Verificada", type: "boolean" },
  ]);
  api.create.mockResolvedValue(saved);
  api.update.mockResolvedValue({ ...saved, version: 2 });
  api.submit.mockResolvedValue({ ...saved, status: "PENDING_REVIEW", version: 2 });
  api.tierOptions.mockResolvedValue({
    policyVersion: { id: "22222222-2222-4222-8222-222222222222", publicVersion: 1 },
    items: [
      { tier: "SILVER", label: "Prata", percentBps: 999 },
      { tier: "GOLD", label: "Ouro", percentBps: 1199 },
      { tier: "DIAMOND", label: "Diamante", percentBps: 1299 },
    ],
  });
});

describe("ListingDraftWizard", () => {
  it("loads policy-backed tiers without preselection or recommendation", async () => {
    render(<ListingDraftWizard />);
    fireEvent.click(screen.getByRole("button", { name: /5\. Preferências/i }));
    await waitFor(() => expect(api.tierOptions).toHaveBeenCalledOnce());
    for (const [label, rate] of [
      ["Prata", "9,99%"],
      ["Ouro", "11,99%"],
      ["Diamante", "12,99%"],
    ]) {
      const card = screen.getByRole("button", { name: new RegExp(label) });
      expect(card).toHaveTextContent(rate);
      expect(card).not.toHaveClass("border-primary");
    }
    expect(screen.queryByText("Recomendado")).not.toBeInTheDocument();
  });

  it("does not submit without an explicitly selected tier", async () => {
    render(<ListingDraftWizard />);
    await waitFor(() => expect(api.tierOptions).toHaveBeenCalledOnce());
    fireEvent.click(screen.getByRole("button", { name: /6\. Revisão/i }));
    fireEvent.click(screen.getByRole("button", { name: /Enviar para análise/i }));
    expect(api.submit).not.toHaveBeenCalled();
    expect(toast.error).toHaveBeenCalledWith(expect.stringContaining("Selecione Prata"));
  });

  it("renders six real steps and saves with create before patching", async () => {
    render(<ListingDraftWizard />);
    expect(screen.getByText(/Etapa 1 — Classificação/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar rascunho/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() => expect(api.update).toHaveBeenCalled());
  });

  it("changes content by step, blocks automatic delivery submit and keeps previews local", async () => {
    render(<ListingDraftWizard />);
    fireEvent.click(screen.getByRole("button", { name: /2\. Informações/i }));
    expect(screen.getByText(/Etapa 2 — Informações/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /3\. Entrega/i }));
    fireEvent.click(screen.getByText(/Entrega automática — Em breve/i));
    fireEvent.click(screen.getByRole("button", { name: /6\. Revisão/i }));
    expect(screen.getByText(/A aprovação da moderação não publica/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Enviar para análise/i })).toBeDisabled();
    expect(api.submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /4\. Imagens/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /adicionar preview local/i })[0]);
    fireEvent.click(screen.getByRole("button", { name: /Salvar rascunho/i }));
    await waitFor(() => expect(api.create).toHaveBeenCalled());
    expect(JSON.stringify(api.create.mock.calls[0][0])).not.toContain("blob:local");
  });

  it("is read-only for pending review drafts", () => {
    render(<ListingDraftWizard initialDraft={{ ...saved, status: "PENDING_REVIEW" }} />);
    expect(screen.getByText(/Pendente de análise — somente leitura/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Salvar rascunho/i })).toBeDisabled();
  });
});
