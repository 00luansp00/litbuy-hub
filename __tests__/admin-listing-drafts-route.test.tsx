import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const api = {
  adminList: vi.fn(),
  adminGet: vi.fn(),
  startReview: vi.fn(),
  approve: vi.fn(),
  reject: vi.fn(),
};
const catalog = { getCategories: vi.fn() };
const toast = { success: vi.fn(), error: vi.fn() };
vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
}));
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <main>
      <h1>{title}</h1>
      {children}
    </main>
  ),
}));
vi.mock("@/components/common/EmptyState", () => ({
  EmptyState: ({ title }: { title: string }) => <div>{title}</div>,
}));
vi.mock("@/services/listingDraftApiService", () => ({ listingDraftApiService: api }));
vi.mock("@/services/catalogService", () => ({ catalogService: catalog }));

const summary = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "PENDING_REVIEW",
  model: "NORMAL",
  title: "Rascunho",
  category: null,
  subcategory: null,
  productType: "account",
  price: "10.00",
  stock: 1,
  wizardStep: 2,
  version: 1,
  submittedAt: null,
  updatedAt: new Date(0).toISOString(),
  rejectionCode: null,
  rejectionReason: null,
  seller: {
    id: "22222222-2222-4222-8222-222222222222",
    storeName: "Loja",
    slug: "loja",
    status: "ACTIVE",
    verified: false,
  },
  reviewer: null,
  reviewStartedAt: null,
  reviewedAt: null,
  approvedAt: null,
};
const detail = {
  ...summary,
  description: "Descrição",
  categoryId: null,
  subcategoryId: null,
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
  variants: [],
  attributes: [],
  serviceDetails: null,
  accountDetails: null,
};

async function renderRoute() {
  const mod = await import("@/routes/admin.anuncios");
  return render(React.createElement(mod.Route.component));
}

beforeEach(() => {
  vi.clearAllMocks();
  catalog.getCategories.mockResolvedValue([{ id: "cat", slug: "contas", name: "Contas" }]);
  api.adminList.mockResolvedValue({ items: [summary], nextCursor: "next" });
  api.adminGet.mockResolvedValue(detail);
  api.startReview.mockResolvedValue({ ...detail, status: "UNDER_REVIEW", version: 2 });
  api.approve.mockResolvedValue({ ...detail, status: "APPROVED", version: 2 });
  api.reject.mockResolvedValue({ ...detail, status: "REJECTED", version: 2 });
});

describe("/admin/anuncios", () => {
  it("loads pages, fetches detail and starts review", async () => {
    await renderRoute();
    fireEvent.click(await screen.findByText("Rascunho"));
    expect(await screen.findByText("Descrição")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Iniciar análise/i }));
    await waitFor(() => expect(api.startReview).toHaveBeenCalledWith(summary.id, summary.version));
  });

  it("requires rejection reason and can reject with selected code", async () => {
    await renderRoute();
    fireEvent.click(await screen.findByText("Rascunho"));
    await screen.findByText("Descrição");
    expect(screen.getByRole("button", { name: /Rejeitar/i })).toBeDisabled();
    fireEvent.change(screen.getByPlaceholderText(/Motivo obrigatório/i), {
      target: { value: "Conteúdo incompleto" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Rejeitar/i }));
    await waitFor(() => expect(api.reject).toHaveBeenCalled());
  });
});
