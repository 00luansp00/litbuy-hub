import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { TwoFactorSecuritySection } from "@/components/account/security/TwoFactorSecuritySection";
import { twoFactorSecurityService } from "@/services/auth/twoFactorSecurity";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return { ...actual, useNavigate: () => mocks.navigate };
});

function auth(): AuthContextValue {
  return {
    user: null,
    isAuthenticated: true,
    initializing: false,
    loading: false,
    status: "authenticated",
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup(
  options: { emailVerified?: boolean; phoneVerified?: boolean; strict?: boolean } = {},
) {
  cleanup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const authValue = auth();
  const ui = (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <TwoFactorSecuritySection
          isAuthenticated
          emailVerified={options.emailVerified ?? true}
          phoneVerified={options.phoneVerified ?? false}
        />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const view = render(options.strict ? <React.StrictMode>{ui}</React.StrictMode> : ui);
  return { queryClient, authValue, unmount: view.unmount };
}

function cacheText(queryClient: QueryClient) {
  return JSON.stringify({
    queries: queryClient.getQueryCache().getAll(),
    mutations: queryClient.getMutationCache().getAll(),
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.navigate.mockReset();
  mocks.toast.info.mockReset();
  setAccessToken("access-token");
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("TwoFactorSecuritySection", () => {
  it("shows loading, disabled status, method availability and validation", async () => {
    vi.spyOn(twoFactorSecurityService, "getTwoFactorStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    setup({ phoneVerified: false });
    expect(screen.getByText(/carregando status real/i)).toBeInTheDocument();
    expect(await screen.findByText(/Status:/i)).toBeInTheDocument();
    expect(screen.getByText(/SMS \(confirme seu telefone primeiro\)/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ativar 2fa/i })).toBeEnabled();
    fireEvent.click(screen.getByRole("button", { name: /ativar 2fa/i }));
    expect(screen.getByText("Informe a senha atual.")).toBeInTheDocument();
  });

  it("requests EMAIL enrollment once, confirms, displays recovery codes once and keeps secrets out of caches", async () => {
    vi.spyOn(twoFactorSecurityService, "getTwoFactorStatus")
      .mockResolvedValueOnce({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      })
      .mockResolvedValue({
        enabled: true,
        method: "EMAIL",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 10,
      });
    const { queryClient } = setup({ emailVerified: true, phoneVerified: true });
    const request = vi
      .spyOn(twoFactorSecurityService, "requestTwoFactorEnrollment")
      .mockResolvedValue({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
      });
    vi.spyOn(twoFactorSecurityService, "confirmTwoFactorEnrollment").mockResolvedValue({
      recoveryCodes: Array.from({ length: 10 }, (_, i) => `AAAAA-AAAAA-AAAA${i}`),
    });
    await screen.findByText(/desativado/i);
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "secret pass" } });
    const button = screen.getByRole("button", { name: /ativar 2fa/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith({ method: "EMAIL", currentPassword: "secret pass" });
    fireEvent.change(await screen.findByLabelText(/código de ativação/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar ativação/i }));
    expect(await screen.findByText("AAAAA-AAAAA-AAAA0")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /fechar códigos/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/confirmei que guardei/i));
    fireEvent.click(screen.getByRole("button", { name: /fechar códigos/i }));
    await waitFor(() => expect(screen.queryByText("AAAAA-AAAAA-AAAA0")).not.toBeInTheDocument());
    expect(cacheText(queryClient)).not.toContain("secret pass");
    expect(cacheText(queryClient)).not.toContain("AAAAA-AAAAA-AAAA0");
    expect(location.href).not.toContain("11111111");
    expect(JSON.stringify(localStorage)).not.toContain("secret pass");
  });

  it("supports SMS enrollment resend preserving challenge on error and clearing code on success", async () => {
    vi.spyOn(twoFactorSecurityService, "getTwoFactorStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    const request = vi
      .spyOn(twoFactorSecurityService, "requestTwoFactorEnrollment")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
      })
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "rate"))
      .mockResolvedValueOnce({
        challengeId: "22222222-2222-4222-8222-222222222222",
        expiresAt: "2026-07-16T12:30:00.000Z",
      });
    setup({ emailVerified: true, phoneVerified: true });
    await screen.findByText(/desativado/i);
    fireEvent.click(screen.getByLabelText(/SMS/i));
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "secret pass" } });
    fireEvent.click(screen.getByRole("button", { name: /ativar 2fa/i }));
    await screen.findByText(/12:00/);
    fireEvent.change(screen.getByLabelText(/código de ativação/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar novo código/i }));
    expect(
      await screen.findByText("Muitas tentativas. Aguarde alguns minutos."),
    ).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /enviar novo código/i }));
    expect(await screen.findByText(/12:30/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código de ativação/i)).toHaveValue("");
    expect(request).toHaveBeenCalledTimes(3);
  });

  it("requests disable, rejects invalid input, confirms with recovery code and clears auth", async () => {
    vi.spyOn(twoFactorSecurityService, "getTwoFactorStatus").mockResolvedValue({
      enabled: true,
      method: "EMAIL",
      enabledAt: "2026-07-16T12:00:00.000Z",
      recoveryCodesRemaining: 1,
    });
    const { authValue, queryClient } = setup();
    queryClient.setQueryData(["auth", "private"], { secret: true });
    const request = vi
      .spyOn(twoFactorSecurityService, "requestTwoFactorDisable")
      .mockResolvedValue({
        challengeId: "33333333-3333-4333-8333-333333333333",
        expiresAt: "2026-07-16T12:00:00.000Z",
      });
    const confirm = vi
      .spyOn(twoFactorSecurityService, "confirmTwoFactorDisable")
      .mockResolvedValue({ message: "done" });
    await screen.findByRole("button", { name: /solicitar desativação/i });
    fireEvent.click(screen.getByRole("button", { name: /solicitar desativação/i }));
    expect(screen.getByText("Informe a senha atual.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "secret pass" } });
    fireEvent.click(screen.getByLabelText(/entendo que desativar/i));
    fireEvent.click(screen.getByRole("button", { name: /solicitar desativação/i }));
    await waitFor(() => expect(request).toHaveBeenCalledWith({ currentPassword: "secret pass" }));
    fireEvent.change(await screen.findByLabelText(/código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.change(screen.getByLabelText(/ou recovery code/i), {
      target: { value: "aaaaabbbbbccccc" },
    });
    fireEvent.click(screen.getByRole("button", { name: /confirmar desativação/i }));
    expect(screen.getByText("Use código ou recovery code, nunca ambos.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/código de seis dígitos/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar desativação/i }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        challengeId: "33333333-3333-4333-8333-333333333333",
        recoveryCode: "AAAAA-BBBBB-CCCCC",
      }),
    );
    await waitFor(() => expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
  });

  it("opens enrollment challenge under StrictMode and avoids UI updates after real unmount", async () => {
    const pending = deferred<{ challengeId: string; expiresAt: string }>();
    vi.spyOn(twoFactorSecurityService, "getTwoFactorStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    vi.spyOn(twoFactorSecurityService, "requestTwoFactorEnrollment").mockReturnValue(
      pending.promise,
    );
    setup({ strict: true });
    await screen.findByText(/desativado/i);
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "secret pass" } });
    fireEvent.click(screen.getByRole("button", { name: /ativar 2fa/i }));
    pending.resolve({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
    });
    expect(await screen.findByLabelText(/código de ativação/i)).toBeInTheDocument();
    cleanup();
    const pendingAfterUnmount = deferred<{ challengeId: string; expiresAt: string }>();
    vi.spyOn(twoFactorSecurityService, "requestTwoFactorEnrollment").mockReturnValue(
      pendingAfterUnmount.promise,
    );
    const view = setup();
    await screen.findByText(/desativado/i);
    fireEvent.change(screen.getByLabelText(/senha atual/i), { target: { value: "secret pass" } });
    fireEvent.click(screen.getByRole("button", { name: /ativar 2fa/i }));
    view.unmount();
    pendingAfterUnmount.resolve({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
    });
    await waitFor(() =>
      expect(screen.queryByLabelText(/código de ativação/i)).not.toBeInTheDocument(),
    );
  });
});
