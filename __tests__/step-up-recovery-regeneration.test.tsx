import React, { StrictMode } from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { TwoFactorSecuritySection } from "@/components/account/security/TwoFactorSecuritySection";
import { stepUpSecurityService } from "@/services/auth/stepUpSecurity";
import { accountSecurityQueryKeys } from "@/services/auth/useAccountSecurity";
import { twoFactorSecurityService } from "@/services/auth/twoFactorSecurity";

const mocks = vi.hoisted(() => ({
  navigate: vi.fn(),
  toast: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router")),
  useNavigate: () => mocks.navigate,
}));

const challenge = {
  challengeId: "123e4567-e89b-42d3-a456-426614174000",
  scope: "TWO_FACTOR_RECOVERY_REGENERATE" as const,
  method: "EMAIL" as const,
  expiresAt: "2027-07-16T12:00:00.000Z",
};
const nextChallenge = {
  challengeId: "223e4567-e89b-42d3-a456-826614174001",
  scope: "TWO_FACTOR_RECOVERY_REGENERATE" as const,
  method: "SMS" as const,
  expiresAt: "2027-07-16T12:05:00.000Z",
};
const codes = [
  "ABCDE-12345-FGHIJ",
  "BCDEF-23456-GHIJK",
  "CDEFG-34567-HIJKL",
  "DEFGH-45678-IJKLM",
  "EFGHI-56789-JKLMN",
  "FGHIJ-67890-KLMNO",
  "GHIJK-78901-LMNOP",
  "HIJKL-89012-MNOPQ",
  "IJKLM-90123-NOPQR",
  "JKLMN-01234-OPQRS",
];

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
    switchToBuyer: vi.fn(() => ({ ok: true, needsOnboarding: false })),
    switchToSeller: vi.fn(() => ({ ok: true, needsOnboarding: false })),
    toggleRole: vi.fn(() => ({ ok: true, needsOnboarding: false, role: "buyer" })),
  };
}
type SetupOptions = {
  strict?: boolean;
  statusQueryFn?: ReturnType<typeof vi.fn>;
  sessionsQueryFn?: ReturnType<typeof vi.fn>;
};
const enabledStatus = {
  enabled: true,
  method: "EMAIL" as const,
  enabledAt: "2026-07-16T12:00:00.000Z",
  recoveryCodesRemaining: 3,
};
function SessionsProbe({ queryFn }: { queryFn: ReturnType<typeof vi.fn> }) {
  useQuery({ queryKey: accountSecurityQueryKeys.sessions, queryFn, retry: false });
  return null;
}
function setup(options: boolean | SetupOptions = false) {
  cleanup();
  const normalized = typeof options === "boolean" ? { strict: options } : options;
  const statusQueryFn = normalized.statusQueryFn ?? vi.fn().mockResolvedValue(enabledStatus);
  vi.spyOn(twoFactorSecurityService, "getStatus").mockImplementation(statusQueryFn);
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue = auth();
  const ui = (
    <>
      {normalized.sessionsQueryFn ? <SessionsProbe queryFn={normalized.sessionsQueryFn} /> : null}
      <TwoFactorSecuritySection smsAvailable />
    </>
  );
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        {normalized.strict ? <StrictMode>{ui}</StrictMode> : ui}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient, authValue, statusQueryFn, ...view };
}
async function startFlow() {
  await screen.findByRole("button", { name: /Regenerar recovery codes/i });
  fireEvent.click(screen.getByRole("button", { name: /Regenerar recovery codes/i }));
  expect(screen.queryByLabelText(/Senha atual/i)).not.toBeInTheDocument();
  fireEvent.click(screen.getByLabelText(/Confirmo que desejo regenerar/i));
  fireEvent.click(screen.getByRole("button", { name: /Regenerar recovery codes/i }));
  return screen.findByLabelText(/Senha atual/i);
}
async function requestChallenge(password = "secret") {
  fireEvent.change(await startFlow(), { target: { value: password } });
  fireEvent.click(screen.getByRole("button", { name: /Solicitar código/i }));
  return screen.findByLabelText(/Código de seis dígitos/i);
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.navigate.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.info.mockReset();
  mocks.toast.success.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("step-up recovery regeneration UI", () => {
  it("requires explicit confirmation and keeps regeneration exclusive until cleanup", async () => {
    const request = vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    const { unmount } = setup();
    await screen.findByText(/ativo por EMAIL/i);
    const startButton = screen.getByRole("button", { name: /Regenerar recovery codes/i });
    expect(startButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmo que desejo regenerar/i));
    expect(request).not.toHaveBeenCalled();
    fireEvent.click(startButton);
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar código/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    unmount();
  });

  it("validates required password, exact request payload and single-flights in StrictMode", async () => {
    const pending = deferred<typeof challenge>();
    const request = vi
      .spyOn(stepUpSecurityService, "requestStepUp")
      .mockReturnValue(pending.promise);
    setup({ strict: true });
    await startFlow();
    fireEvent.click(screen.getByRole("button", { name: /Solicitar código/i }));
    expect(await screen.findByText(/Informe a senha atual/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar código/i }));
    fireEvent.click(screen.getByRole("button", { name: /Solicitando/i }));
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith("secret");
    cleanup();
    pending.resolve(challenge);
    await pending.promise;
  });

  it("preserves challenge and avoids backend calls on local validation errors", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    const verify = vi
      .spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes")
      .mockResolvedValue({ recoveryCodes: codes });
    setup();
    await requestChallenge();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/Informe código de seis dígitos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(screen.getByLabelText(/Código de seis dígitos/i)).toHaveValue("123");
    fireEvent.change(screen.getByLabelText(/Recovery code/i), { target: { value: "ABCDE" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(screen.getByText(/Código enviado por e-mail/i)).toBeInTheDocument();
    expect(verify).not.toHaveBeenCalled();
  });

  it("verifies by code or normalized recovery and preserves or resets challenge by error type", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    const verify = vi
      .spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes")
      .mockRejectedValueOnce(new ApiError(400, "INVALID_OR_EXPIRED_STEP_UP_CODE", "bad"))
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow"))
      .mockRejectedValueOnce(new ApiError(400, "STEP_UP_CHALLENGE_LOCKED", "locked"));
    setup();
    await requestChallenge();
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/Código inválido ou expirado/i)).toBeInTheDocument();
    expect(screen.getByText(/Código enviado por e-mail/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/Muitas tentativas/i)).toBeInTheDocument();
    expect(screen.getByText(/Código enviado por e-mail/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/Inicie uma nova confirmação/i)).toBeInTheDocument();
    expect(screen.queryByText(/Código enviado por e-mail/i)).not.toBeInTheDocument();
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();
    expect(verify).toHaveBeenNthCalledWith(1, {
      challengeId: challenge.challengeId,
      code: "123456",
    });
  });

  it("resends with success/rate limit/delivery unavailable semantics and unmount safety", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    const resend = vi
      .spyOn(stepUpSecurityService, "resendStepUp")
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow"))
      .mockResolvedValueOnce(nextChallenge)
      .mockRejectedValueOnce(new ApiError(503, "STEP_UP_DELIVERY_UNAVAILABLE", "down"));
    setup();
    await requestChallenge();
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    expect(await screen.findByText(/Aguarde antes de reenviar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Código de seis dígitos/i)).toHaveValue("123456");
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    expect((await screen.findAllByText(/Código enviado por SMS/i)).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/Código de seis dígitos/i)).toHaveValue("");
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    expect(await screen.findByText(/Entrega indisponível/i)).toBeInTheDocument();
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();
    expect(resend).toHaveBeenCalledTimes(3);
  });

  it("shows codes before auxiliary refetches and does not clear auth or navigate", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    vi.spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes").mockResolvedValue({
      recoveryCodes: codes,
    });
    const { queryClient, authValue } = setup();
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("background"));
    await requestChallenge();
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(codes[0])).toBeInTheDocument();
    expect(authValue.clearAuthentication).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
  });

  it("handles malformed and close reconciliation success/failure without restoring codes", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    const verify = vi
      .spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes")
      .mockRejectedValueOnce(new ApiError(502, "MALFORMED_RESPONSE", "bad"))
      .mockResolvedValueOnce({ recoveryCodes: codes });
    const { queryClient } = setup();
    const refetch = vi.spyOn(queryClient, "refetchQueries").mockResolvedValue(undefined);
    await requestChallenge();
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/podem ter sido regenerados/i)).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Regenerar recovery codes/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmo que desejo regenerar/i));
    fireEvent.click(screen.getByRole("button", { name: /Regenerar recovery codes/i }));
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar código/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    fireEvent.change(screen.getByLabelText(/Recovery code/i), {
      target: { value: "abcde12345fghij" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(codes[0])).toBeInTheDocument();
    refetch
      .mockRejectedValueOnce(new Error("sessions failed"))
      .mockRejectedValueOnce(new Error("sessions failed"))
      .mockResolvedValue(undefined);
    fireEvent.click(screen.getByLabelText(/Confirmei que guardei/i));
    fireEvent.click(screen.getByRole("button", { name: /Fechar recovery codes/i }));
    await waitFor(() => expect(screen.queryByText(codes[0])).not.toBeInTheDocument());
    expect(
      await screen.findByRole("button", { name: /Tentar reconciliar novamente/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    expect(
      await screen.findByRole("button", { name: /Regenerar recovery codes/i }),
    ).toBeInTheDocument();
    expect(verify).toHaveBeenLastCalledWith({
      challengeId: challenge.challengeId,
      recoveryCode: codes[0],
    });
  });

  it("keeps the UI blocked when the real status query refetch fails, then releases after retry", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    vi.spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes").mockRejectedValue(
      new ApiError(0, "RECOVERY_REGENERATION_OUTCOME_UNKNOWN", "unknown"),
    );
    const statusQueryFn = vi.fn().mockResolvedValue(enabledStatus);
    const sessionsQueryFn = vi.fn().mockResolvedValue({ sessions: [] });
    const { authValue } = setup({ statusQueryFn, sessionsQueryFn });
    await requestChallenge();
    statusQueryFn
      .mockRejectedValueOnce(new Error("status failed"))
      .mockResolvedValue(enabledStatus);
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/não foi possível confirmar ou exibir/i)).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível atualizar o status/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(codes[0])).not.toBeInTheDocument();
    expect(authValue.clearAuthentication).not.toHaveBeenCalled();
    expect(mocks.navigate).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    const startButton = await screen.findByRole("button", { name: /Regenerar recovery codes/i });
    expect(startButton).toBeDisabled();
    expect(screen.getByText(/não foi possível confirmar ou exibir/i)).toBeInTheDocument();
    expect(screen.queryByText(/Não foi possível atualizar o status/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/Senha atual/i)).not.toBeInTheDocument();
  });

  it("keeps the UI blocked when the real sessions query refetch fails, then releases after retry", async () => {
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    vi.spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes").mockRejectedValue(
      new ApiError(502, "MALFORMED_RESPONSE", "bad"),
    );
    const statusQueryFn = vi.fn().mockResolvedValue(enabledStatus);
    const sessionsQueryFn = vi.fn().mockResolvedValue({ sessions: [] });
    setup({ statusQueryFn, sessionsQueryFn });
    await requestChallenge();
    sessionsQueryFn
      .mockRejectedValueOnce(new Error("sessions failed"))
      .mockResolvedValue({ sessions: [] });
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    expect(await screen.findByText(/não foi possível confirmar ou exibir/i)).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível atualizar o status/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    const startButton = await screen.findByRole("button", { name: /Regenerar recovery codes/i });
    expect(startButton).toBeDisabled();
    expect(screen.queryByText(/Não foi possível atualizar o status/i)).not.toBeInTheDocument();
  });

  it("handles clipboard outcomes and keeps secrets out of caches, storage, URL, toast and console", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(stepUpSecurityService, "requestStepUp").mockResolvedValue(challenge);
    vi.spyOn(stepUpSecurityService, "verifyStepUpAndRegenerateRecoveryCodes").mockResolvedValue({
      recoveryCodes: codes,
    });
    const writeText = vi
      .fn()
      .mockResolvedValue(undefined)
      .mockRejectedValueOnce(new Error("denied"));
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    const { queryClient, authValue, unmount } = setup();
    await requestChallenge("top-secret");
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar e regenerar/i }));
    await screen.findByText(codes[0]);
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());
    writeText.mockImplementationOnce(() => Promise.reject(new Error("denied")));
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    expect(await screen.findByText(/Não foi possível copiar/i)).toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    expect(await screen.findByText(/Clipboard indisponível/i)).toBeInTheDocument();
    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(codes[0]);
    expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(codes[0]);
    expect(JSON.stringify(localStorage)).not.toContain("top-secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("123456");
    expect(location.href).not.toContain(challenge.challengeId);
    expect(JSON.stringify(authValue)).not.toContain("opaque-step-up");
    expect(JSON.stringify(mocks.toast)).not.toContain(codes[0]);
    unmount();
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
