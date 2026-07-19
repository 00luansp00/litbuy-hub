import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { api, toast } = vi.hoisted(() => ({
  api: { list: vi.fn(), submit: vi.fn() },
  toast: { success: vi.fn(), error: vi.fn() },
}));
vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
vi.mock("@/components/auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/seller-dashboard/SellerDashboardLayout", () => ({
  SellerDashboardLayout: ({ children, title }: { children: React.ReactNode; title: string }) => (
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

const item = {
  id: "11111111-1111-4111-8111-111111111111",
  status: "DRAFT",
  model: "NORMAL",
  title: "Rascunho",
  category: { id: "22222222-2222-4222-8222-222222222222", slug: "contas", name: "Contas" },
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
};

async function renderRoute() {
  const mod = await import("@/routes/vendedor.anuncios.index");
  return render(React.createElement(mod.Route.component));
}

beforeEach(() => {
  vi.clearAllMocks();
  api.list.mockResolvedValue({ items: [item], nextCursor: "next" });
  api.submit.mockResolvedValue({ ...item, status: "PENDING_REVIEW" });
});

describe("/vendedor/anuncios", () => {
  it("loads, paginates without duplicates and submits only allowed statuses", async () => {
    await renderRoute();
    expect(await screen.findByText("Rascunho")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Carregar mais/i }));
    await waitFor(() => expect(api.list).toHaveBeenCalledTimes(2));
    expect(screen.getAllByText("Rascunho")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: /^Enviar$/i }));
    await waitFor(() => expect(api.submit).toHaveBeenCalledWith(item.id, item.version));
  });

  it("resets on filters and shows empty state", async () => {
    api.list.mockResolvedValueOnce({ items: [], nextCursor: null });
    await renderRoute();
    expect(await screen.findByText(/Você ainda não tem rascunhos/i)).toBeInTheDocument();
  });
});
