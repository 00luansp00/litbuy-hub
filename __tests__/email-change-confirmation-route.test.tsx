import React, { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { phoneEmailSecurityService } from "@/services/auth/phoneEmailSecurity";

let mockSearch: { token?: string } = {};
let tokenCounter = 0;
const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
const navigate = mocks.navigate;
const toast = mocks.toast;
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => ({
      ...options,
      useSearch: () => mockSearch,
    }),
    useNavigate: () => mocks.navigate,
  };
});

function auth(): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    initializing: false,
    loading: false,
    status: "anonymous",
    activeRole: "buyer",
    hasSellerProfile: false,
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
  };
}

async function setup(strict = false) {
  cleanup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue = auth();
  const mod = await import("../src/routes/confirmar-alteracao-email");
  const element = React.createElement(mod.Route.component);
  const ui = (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        {strict ? <StrictMode>{element}</StrictMode> : element}
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const view = render(ui);
  return { queryClient, authValue, mod, rerender: () => view.rerender(ui) };
}

function cacheText(queryClient: QueryClient) {
  return JSON.stringify(queryClient.getMutationCache().getAll());
}

beforeEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(globalThis, "__litbuySubmittedEmailChangeTokens");
  tokenCounter += 1;
  mockSearch = { token: `email-token-${tokenCounter}.secret` };
  navigate.mockReset();
  navigate.mockImplementation((options: { search?: { token?: string } }) => {
    if (options.search?.token === undefined) {
      mockSearch = {};
    }
  });
  toast.error.mockReset();
  toast.info.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(
    null,
    "",
    `/confirmar-alteracao-email?token=email-token-${tokenCounter}.secret`,
  );
});

describe("email change confirmation route", () => {
  it("captures token once, removes it with replace, requires new email, and does not consume on rerender", async () => {
    const confirm = vi.spyOn(phoneEmailSecurityService, "confirmEmailChange");
    await setup();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/confirmar-alteracao-email",
        search: { token: undefined },
        replace: true,
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    expect(screen.getByText("Informe o novo e-mail para validar o token.")).toBeInTheDocument();
    expect(confirm).not.toHaveBeenCalled();
  });

  it("consumes token exactly once on PENDING and keeps authentication", async () => {
    const { queryClient, authValue } = await setup();
    const confirm = vi.spyOn(phoneEmailSecurityService, "confirmEmailChange").mockResolvedValue({
      status: "PENDING",
      message: "pending",
    });
    fireEvent.change(screen.getByLabelText(/novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    const button = screen.getByRole("button", { name: /confirmar alteração/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledWith({
      token: `email-token-${tokenCounter}.secret`,
      newEmail: "new@example.com",
    });
    expect(
      screen.getByText("Confirmação registrada. Ainda falta a outra confirmação."),
    ).toBeInTheDocument();
    expect(authValue.clearAuthentication).not.toHaveBeenCalled();
    expect(cacheText(queryClient)).not.toContain(`email-token-${tokenCounter}.secret`);
    expect(cacheText(queryClient)).not.toContain("new@example.com");
    expect(Reflect.has(globalThis, "__litbuySubmittedEmailChangeTokens")).toBe(false);
    fireEvent.click(button);
    expect(confirm).toHaveBeenCalledTimes(1);
  });

  it("does not lose the URL token before a valid StrictMode confirmation", async () => {
    const { rerender, queryClient } = await setup(true);
    const confirm = vi.spyOn(phoneEmailSecurityService, "confirmEmailChange").mockResolvedValue({
      status: "PENDING",
      message: "pending",
    });
    await waitFor(() => expect(mockSearch).toEqual({}));
    rerender();
    fireEvent.change(screen.getByLabelText(/novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    const button = screen.getByRole("button", { name: /confirmar alteração/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(1));
    expect(cacheText(queryClient)).not.toContain(`email-token-${tokenCounter}.secret`);
  });

  it("handles COMPLETED by clearing auth, navigating to login, and preventing private query repopulation", async () => {
    const { queryClient, authValue } = await setup();
    let resolvePrivate!: (value: { leaked: boolean }) => void;
    const privatePromise = new Promise<{ leaked: boolean }>((resolve) => {
      resolvePrivate = resolve;
    });
    void queryClient
      .fetchQuery({ queryKey: ["auth", "late"], queryFn: () => privatePromise })
      .catch(() => undefined);
    vi.spyOn(phoneEmailSecurityService, "confirmEmailChange").mockResolvedValue({
      status: "COMPLETED",
      message: "done",
    });
    fireEvent.change(screen.getByLabelText(/novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    await waitFor(() => expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
    resolvePrivate({ leaked: true });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(queryClient.getQueryData(["auth", "late"])).toBeUndefined();
  });

  it("works in a new tab without previous state and handles invalid token/status without storage leaks", async () => {
    const { queryClient } = await setup();
    vi.spyOn(phoneEmailSecurityService, "confirmEmailChange")
      .mockRejectedValueOnce(new ApiError(400, "INVALID_OR_EXPIRED_TOKEN", "bad"))
      .mockRejectedValueOnce(new ApiError(502, "MALFORMED_RESPONSE", "bad"));
    fireEvent.change(screen.getByLabelText(/novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    expect(
      await screen.findByText("Token inválido, expirado ou já utilizado."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    expect(await screen.findByText("Resposta inválida da API.")).toBeInTheDocument();
    expect(JSON.stringify(localStorage)).not.toContain(`email-token-${tokenCounter}.secret`);
    expect(JSON.stringify(sessionStorage)).not.toContain("new@example.com");
    expect(cacheText(queryClient)).not.toContain(`email-token-${tokenCounter}.secret`);
    expect(Reflect.has(globalThis, "__litbuySubmittedEmailChangeTokens")).toBe(false);
  });

  it("allows a second attempt after a recoverable token error without storing token globally", async () => {
    await setup();
    const confirm = vi
      .spyOn(phoneEmailSecurityService, "confirmEmailChange")
      .mockRejectedValueOnce(new ApiError(400, "INVALID_OR_EXPIRED_TOKEN", "bad"))
      .mockResolvedValueOnce({ status: "PENDING", message: "pending" });
    fireEvent.change(screen.getByLabelText(/novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    expect(
      await screen.findByText("Token inválido, expirado ou já utilizado."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar alteração/i }));
    await waitFor(() => expect(confirm).toHaveBeenCalledTimes(2));
    expect(Reflect.has(globalThis, "__litbuySubmittedEmailChangeTokens")).toBe(false);
  });
});
