import React, { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { twoFactorSecurityService } from "@/services/auth/twoFactorSecurity";
import { TwoFactorSecuritySection } from "@/components/account/security/TwoFactorSecuritySection";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router")),
  useNavigate: () => mocks.navigate,
}));

const stepUpChallenge = {
  challengeId: "550e8400-e29b-41d4-a716-446655440000",
  scope: "TWO_FACTOR_METHOD_CHANGE" as const,
  method: "EMAIL" as const,
  expiresAt: "2099-07-16T12:00:00.000Z",
  message: "sent",
};
const methodChallenge = {
  challengeId: "660e8400-e29b-41d4-a716-446655440001",
  expiresAt: "2099-07-16T12:05:00.000Z",
  message: "sent",
};
const grant = {
  stepUpToken: "opaque-step-up-token",
  scope: "TWO_FACTOR_METHOD_CHANGE" as const,
  expiresAt: "2099-07-16T12:10:00.000Z",
};

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
};
function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

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

function status(method: "EMAIL" | "SMS" = "EMAIL") {
  return {
    enabled: true,
    method,
    enabledAt: "2099-07-16T12:00:00.000Z",
    recoveryCodesRemaining: 8,
  };
}

function setup(smsAvailable = true, strict = false) {
  cleanup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue = auth();
  const element = <TwoFactorSecuritySection smsAvailable={smsAvailable} />;
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        {strict ? <StrictMode>{element}</StrictMode> : element}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient, authValue, ...view };
}

async function startMethodChange() {
  await screen.findByRole("button", { name: /Alterar método de 2FA/i });
  fireEvent.click(screen.getByLabelText(/Entendo que outras sessões/i));
  fireEvent.click(screen.getByRole("button", { name: /Alterar método de 2FA/i }));
  await screen.findByLabelText(/Senha da conta/i);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.navigate.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.info.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  setAccessToken("access-token");
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("TwoFactorMethodChange", () => {
  it("is available only for enabled 2FA and valid alternative methods", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      })
      .mockResolvedValueOnce(status("EMAIL"))
      .mockResolvedValueOnce(status("EMAIL"))
      .mockResolvedValueOnce(status("SMS"));
    setup();
    await screen.findByText(/Status: inativo/i);
    expect(
      screen.queryByRole("button", { name: /Alterar método de 2FA/i }),
    ).not.toBeInTheDocument();

    setup(false);
    expect(await screen.findByText(/Confirme um telefone/i)).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /SMS/i })).not.toBeInTheDocument();

    setup(true);
    await startMethodChange();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    vi.spyOn(twoFactorSecurityService, "requestStepUp").mockResolvedValue(stepUpChallenge);
    vi.spyOn(twoFactorSecurityService, "verifyStepUp").mockResolvedValue(grant);
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByLabelText(/^Código$/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    expect(await screen.findByRole("option", { name: /SMS/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /E-mail/i })).not.toBeInTheDocument();

    setup(true);
    await startMethodChange();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByLabelText(/^Código$/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    expect(await screen.findByRole("option", { name: /E-mail/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /SMS/i })).not.toBeInTheDocument();
  });

  it("does not self-deadlock after claiming exclusivity", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue(status("EMAIL"));
    setup(true);
    await startMethodChange();
    expect(screen.getByRole("button", { name: /Solicitar step-up/i })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Cancelar/i })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Regenerar/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancelar/i }));
    expect(
      await screen.findByRole("button", { name: /Solicitar desativação/i }),
    ).toBeInTheDocument();
  });

  it("validates step-up input, normalizes recovery code, single-flights and resends safely", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue(status("EMAIL"));
    const request = vi
      .spyOn(twoFactorSecurityService, "requestStepUp")
      .mockResolvedValue(stepUpChallenge);
    const verify = vi.spyOn(twoFactorSecurityService, "verifyStepUp").mockResolvedValue(grant);
    const resend = vi
      .spyOn(twoFactorSecurityService, "resendStepUp")
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "rate"))
      .mockResolvedValueOnce({
        ...stepUpChallenge,
        challengeId: "770e8400-e29b-41d4-a716-446655440002",
      });
    setup(true, true);
    await startMethodChange();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    expect(screen.getByText(/Informe a senha atual/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    const button = screen.getByRole("button", { name: /Solicitar step-up/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByLabelText(/^Código$/i);
    expect(request).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    expect(screen.getByText(/Informe o código ou um recovery code/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "12345" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    expect(screen.getByText(/código de seis dígitos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Recovery code/i), {
      target: { value: "abcde12345fghij" },
    });
    expect(screen.getByLabelText(/Recovery code/i)).toHaveValue("ABCDE-12345-FGHIJ");
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    expect(screen.getByText(/Use apenas o código ou o recovery code/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    expect(await screen.findByText(/Muitas tentativas/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Recovery code/i)).toHaveValue("ABCDE-12345-FGHIJ");
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    await waitFor(() => expect(resend).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/Recovery code/i)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/Recovery code/i), {
      target: { value: "ABCDE12345FGHIJ" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    await waitFor(() =>
      expect(verify).toHaveBeenCalledWith({
        challengeId: "770e8400-e29b-41d4-a716-446655440002",
        recoveryCode: "ABCDE-12345-FGHIJ",
      }),
    );
  });

  it("requests and confirms method change with header-only token, reconciles status/sessions, and keeps session", async () => {
    const getStatus = vi
      .spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(status("EMAIL"))
      .mockResolvedValue(status("SMS"));
    vi.spyOn(twoFactorSecurityService, "requestStepUp").mockResolvedValue(stepUpChallenge);
    vi.spyOn(twoFactorSecurityService, "verifyStepUp").mockResolvedValue(grant);
    const requestChange = vi
      .spyOn(twoFactorSecurityService, "requestMethodChange")
      .mockResolvedValue(methodChallenge);
    const confirmChange = vi
      .spyOn(twoFactorSecurityService, "confirmMethodChange")
      .mockResolvedValue({ methodChanged: true });
    const { queryClient, authValue } = setup(true);
    const reconcileStatus = deferred<ReturnType<typeof status>>();
    const fetchQuery = vi
      .spyOn(queryClient, "fetchQuery")
      .mockReturnValueOnce(reconcileStatus.promise);
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    await startMethodChange();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByLabelText(/^Código$/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    await screen.findByLabelText(/Novo método/i);
    fireEvent.change(screen.getByLabelText(/Novo método/i), { target: { value: "SMS" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar troca/i }));
    await screen.findByLabelText(/Código de confirmação/i);
    fireEvent.change(screen.getByLabelText(/Código de confirmação/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/Atualizando o status real/i)).toBeInTheDocument();
    expect(screen.queryByText(/Status da segurança atualizado/i)).not.toBeInTheDocument();
    reconcileStatus.resolve(status("SMS"));
    expect(await screen.findByText(/Status da segurança atualizado/i)).toBeInTheDocument();
    expect(requestChange).toHaveBeenCalledWith({ newMethod: "SMS" }, grant.stepUpToken);
    expect(confirmChange).toHaveBeenCalledWith(
      { challengeId: methodChallenge.challengeId, code: "654321" },
      grant.stepUpToken,
    );
    expect(invalidate).toHaveBeenCalled();
    expect(fetchQuery).toHaveBeenCalled();
    expect(getStatus).toHaveBeenCalled();
    expect(authValue.clearAuthentication).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("keeps critical warning with reconciliation error after ambiguous method-change outcome and retries", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(status("EMAIL"))
      .mockResolvedValue(status("SMS"));
    vi.spyOn(twoFactorSecurityService, "requestStepUp").mockResolvedValue(stepUpChallenge);
    vi.spyOn(twoFactorSecurityService, "verifyStepUp").mockResolvedValue(grant);
    vi.spyOn(twoFactorSecurityService, "requestMethodChange").mockResolvedValue(methodChallenge);
    vi.spyOn(twoFactorSecurityService, "confirmMethodChange").mockRejectedValue(
      new ApiError(503, "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN", "unknown"),
    );
    const { queryClient } = setup(true);
    vi.spyOn(queryClient, "fetchQuery")
      .mockRejectedValueOnce(new Error("status failed"))
      .mockResolvedValueOnce(status("SMS"));
    await startMethodChange();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByLabelText(/^Código$/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    await screen.findByLabelText(/Novo método/i);
    fireEvent.change(screen.getByLabelText(/Novo método/i), { target: { value: "SMS" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar troca/i }));
    await screen.findByLabelText(/Código de confirmação/i);
    fireEvent.change(screen.getByLabelText(/Código de confirmação/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/pode ter sido aplicada/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Não foi possível atualizar o status da segurança/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Status da segurança atualizado/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    expect(await screen.findByText(/Status da segurança atualizado/i)).toBeInTheDocument();
  });

  it("does not keep a grant after pending verify resolves post-unmount", async () => {
    const pendingGrant = deferred<typeof grant>();
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue(status("EMAIL"));
    vi.spyOn(twoFactorSecurityService, "requestStepUp").mockResolvedValue(stepUpChallenge);
    vi.spyOn(twoFactorSecurityService, "verifyStepUp").mockReturnValue(pendingGrant.promise);
    const requestChange = vi
      .spyOn(twoFactorSecurityService, "requestMethodChange")
      .mockResolvedValue(methodChallenge);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = setup(true);
    await startMethodChange();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByLabelText(/^Código$/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar identidade/i }));
    view.unmount();
    pendingGrant.resolve(grant);
    await pendingGrant.promise;
    expect(requestChange).not.toHaveBeenCalled();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
