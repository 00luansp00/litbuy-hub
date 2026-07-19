import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "@/providers/AuthContext";

const service = {
  me: vi.fn(),
  saveDraft: vi.fn(),
  submit: vi.fn(),
  adminList: vi.fn(),
  adminStartReview: vi.fn(),
  adminApprove: vi.fn(),
  adminReject: vi.fn(),
};
const toast = { success: vi.fn(), error: vi.fn() };
let auth: AuthContextValue;

vi.mock("sonner", () => ({ toast }));
vi.mock("@/services/sellerOnboardingService", () => ({ sellerOnboardingService: service }));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@/components/auth/AuthGate", () => ({
  AuthGate: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock("@/components/admin/AdminLayout", () => ({
  AdminLayout: ({ children }: { children: React.ReactNode }) => <main>{children}</main>,
}));
vi.mock("@/components/admin/AdminFilters", () => ({
  AdminFilters: ({
    search,
    onSearchChange,
    status,
    onStatusChange,
  }: {
    search: string;
    onSearchChange: (v: string) => void;
    status: string;
    onStatusChange: (v: string) => void;
  }) => (
    <div>
      <input aria-label="Buscar" value={search} onChange={(e) => onSearchChange(e.target.value)} />
      <button type="button" onClick={() => onStatusChange(status === "all" ? "submitted" : "all")}>
        Trocar status
      </button>
    </div>
  ),
}));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => options,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

const baseAuth = (): AuthContextValue => ({
  user: { id: "u", email: "u@example.com", displayName: "User" },
  isAuthenticated: true,
  initializing: false,
  loading: false,
  status: "authenticated",
  activeRole: "buyer",
  hasSellerProfile: false,
  hasSellerAccess: false,
  isAdmin: false,
  twoFactorChallenge: null,
  login: vi.fn(),
  register: vi.fn(),
  verifyEmail: vi.fn(),
  approveDevice: vi.fn(),
  verifyTwoFactorLogin: vi.fn(),
  resendTwoFactorLogin: vi.fn(),
  resendEmailVerification: vi.fn(),
  resendDeviceApproval: vi.fn(),
  refreshSession: vi.fn(),
  requestPasswordReset: vi.fn(),
  resetPassword: vi.fn(),
  logout: vi.fn(),
  clearAuthentication: vi.fn(),
  switchToBuyer: vi.fn(),
  switchToSeller: vi.fn(() => ({ ok: true, needsOnboarding: false })),
  toggleRole: vi.fn(() => ({ ok: true, needsOnboarding: false, role: "buyer" })),
  reloadCurrentUser: vi.fn(),
});

function renderWithQuery(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

async function renderRoute(path: string) {
  cleanup();
  vi.resetModules();
  const mod = await import(path);
  return renderWithQuery(React.createElement(mod.Route.component));
}

const requirements = {
  emailVerified: true,
  phoneVerified: true,
  ageEligible: true,
  sellerAgreementVersion: "2026-test",
  sellerAgreementAccepted: false,
  sellerAgreementCurrent: false,
};
const app = (status: string) => ({
  id: "11111111-1111-4111-8111-111111111111",
  storeName: "Loja Teste",
  requestedSlug: "loja-teste",
  description: null,
  status,
  submittedAt: "2026-07-19T00:00:00.000Z",
  rejectionCode: status === "rejected" ? "OTHER" : null,
  rejectionReason: status === "rejected" ? "Corrigir." : null,
});
const pageItem = {
  ...app("submitted"),
  requirements: { ...requirements, sellerAgreementAccepted: true, sellerAgreementCurrent: true },
};

beforeEach(() => {
  auth = baseAuth();
  Object.values(service).forEach((fn) => fn.mockReset());
  toast.success.mockReset();
  toast.error.mockReset();
  vi.spyOn(window, "confirm").mockReturnValue(true);
});

describe("/perfil/vendedor", () => {
  it("renders loading, empty requirements, pending phone link, draft submit and rejected correction states", async () => {
    let resolve!: (v: unknown) => void;
    service.me.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await renderRoute("../src/routes/perfil.vendedor");
    expect(screen.getByText(/carregando requisitos/i)).toBeInTheDocument();
    resolve({
      application: null,
      sellerProfile: null,
      requirements: { ...requirements, phoneVerified: false },
    });
    await screen.findByText(/status: sem solicitação/i);
    expect(screen.getByRole("link", { name: /verificar/i })).toHaveAttribute(
      "href",
      "/perfil/seguranca",
    );

    cleanup();
    service.me.mockResolvedValueOnce({
      application: app("draft"),
      sellerProfile: null,
      requirements,
    });
    service.saveDraft.mockResolvedValueOnce(app("draft"));
    service.submit.mockResolvedValueOnce(app("submitted"));
    await renderRoute("../src/routes/perfil.vendedor");
    await screen.findByDisplayValue("Loja Teste");
    fireEvent.click(screen.getByRole("button", { name: /salvar rascunho/i }));
    await waitFor(() => expect(service.saveDraft).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /enviar para análise/i }));
    await waitFor(() => expect(service.submit).toHaveBeenCalled());

    cleanup();
    service.me.mockResolvedValueOnce({
      application: app("rejected"),
      sellerProfile: null,
      requirements,
    });
    await renderRoute("../src/routes/perfil.vendedor");
    expect(await screen.findByText(/solicitação rejeitada/i)).toBeInTheDocument();
  });

  it("does not show seller panel until approved role is confirmed and reloads access once", async () => {
    auth.reloadCurrentUser = vi.fn();
    service.me.mockResolvedValue({
      application: app("approved"),
      sellerProfile: null,
      requirements: {
        ...requirements,
        sellerAgreementAccepted: true,
        sellerAgreementCurrent: true,
      },
    });
    await renderRoute("../src/routes/perfil.vendedor");
    expect(await screen.findByText(/atualizando acesso/i)).toBeInTheDocument();
    expect(screen.queryByText("Ir para o painel do vendedor")).not.toBeInTheDocument();
    await waitFor(() => expect(auth.reloadCurrentUser).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByRole("button", { name: /atualizar acesso/i }));
    expect(auth.reloadCurrentUser).toHaveBeenCalledTimes(2);

    cleanup();
    auth = { ...baseAuth(), hasSellerAccess: true, reloadCurrentUser: vi.fn() };
    service.me.mockResolvedValueOnce({
      application: app("approved"),
      sellerProfile: null,
      requirements: {
        ...requirements,
        sellerAgreementAccepted: true,
        sellerAgreementCurrent: true,
      },
    });
    await renderRoute("../src/routes/perfil.vendedor");
    expect(await screen.findByText("Ir para o painel do vendedor")).toBeInTheDocument();
  });
});

describe("/admin/vendedores", () => {
  it("renders loading, error retry, empty state and paginated accumulated data", async () => {
    let resolve!: (v: unknown) => void;
    service.adminList.mockReturnValueOnce(new Promise((r) => (resolve = r)));
    await renderRoute("../src/routes/admin.vendedores");
    expect(screen.getByText(/carregando solicitações/i)).toBeInTheDocument();
    resolve({ items: [], nextCursor: null });
    expect(await screen.findByText(/nenhuma solicitação encontrada/i)).toBeInTheDocument();

    cleanup();
    service.adminList.mockRejectedValueOnce(new Error("falhou"));
    await renderRoute("../src/routes/admin.vendedores");
    expect(await screen.findByText(/não foi possível carregar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /tentar novamente/i })).toBeInTheDocument();

    cleanup();
    service.adminList
      .mockResolvedValueOnce({ items: [pageItem], nextCursor: pageItem.id })
      .mockResolvedValueOnce({
        items: [
          { ...pageItem, id: "22222222-2222-4222-8222-222222222222", storeName: "Loja Dois" },
        ],
        nextCursor: null,
      });
    await renderRoute("../src/routes/admin.vendedores");
    expect(await screen.findByText("Loja Teste")).toBeInTheDocument();
    expect(screen.getByText("Vigente aceito")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /carregar mais/i }));
    expect(await screen.findByText("Loja Dois")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /carregar mais/i })).not.toBeInTheDocument();
  });

  it("handles admin mutations without optimistic false approval", async () => {
    service.adminList.mockResolvedValue({ items: [pageItem], nextCursor: null });
    service.adminStartReview.mockResolvedValueOnce({ ...pageItem, status: "under_review" });
    service.adminApprove.mockRejectedValueOnce(new Error("approval failed"));
    service.adminReject.mockResolvedValueOnce({ ...pageItem, status: "rejected" });
    await renderRoute("../src/routes/admin.vendedores");
    expect(await screen.findByText("Loja Teste")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /iniciar análise/i }));
    await waitFor(() => expect(service.adminStartReview.mock.calls[0]?.[0]).toBe(pageItem.id));
    fireEvent.click(screen.getByRole("button", { name: /^aprovar$/i }));
    await waitFor(() => expect(service.adminApprove.mock.calls[0]?.[0]).toBe(pageItem.id));
    expect(screen.getByText("Enviado")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /rejeitar/i }));
    expect(await screen.findByText(/rejeitar loja teste/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^confirmar rejeição$/i }));
    await waitFor(() => expect(service.adminReject).toHaveBeenCalled());
  });
});
