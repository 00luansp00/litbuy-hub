import React, { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
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

const challenge = {
  challengeId: "123e4567-e89b-42d3-a456-426614174000",
  expiresAt: "2026-07-16T12:00:00.000Z",
  message: "sent",
};
const nextChallenge = {
  challengeId: "223e4567-e89b-42d3-a456-426614174001",
  expiresAt: "2026-07-16T12:05:00.000Z",
  message: "sent",
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
    switchToBuyer: vi.fn(),
    switchToSeller: vi.fn(() => ({ ok: true, needsOnboarding: false })),
    toggleRole: vi.fn(() => ({ ok: true, needsOnboarding: false, role: "buyer" })),
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

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.navigate.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.info.mockReset();
  setAccessToken("access-token");
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("TwoFactorSecuritySection", () => {
  it("blocks sensitive actions while status is loading or errored, then retries successfully", async () => {
    const first = deferred<Awaited<ReturnType<typeof twoFactorSecurityService.getStatus>>>();
    const getStatus = vi
      .spyOn(twoFactorSecurityService, "getStatus")
      .mockReturnValueOnce(first.promise)
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "internal"))
      .mockResolvedValueOnce({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      });
    setup();
    expect(screen.getByText(/Carregando status real/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar 2FA/i })).not.toBeInTheDocument();
    first.resolve({ enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 0 });
    expect(await screen.findByRole("button", { name: /Ativar 2FA/i })).toBeInTheDocument();
    await waitFor(() => expect(getStatus).toHaveBeenCalledTimes(1));
    fireEvent.click(screen.getByText(/Status: inativo/i));
    await screen.findByRole("button", { name: /Ativar 2FA/i });
    void screen.getByRole("button", { name: /Ativar 2FA/i });
    await screen.findByText(/Status: inativo/i);
    await getStatus.mock.results[0].value;
  });

  it("shows active EMAIL/SMS status and recovery-code warnings without offering regeneration", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce({
        enabled: true,
        method: "EMAIL",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 0,
      })
      .mockResolvedValueOnce({
        enabled: true,
        method: "SMS",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 2,
      });
    setup();
    expect(await screen.findByText(/ativo por EMAIL/i)).toBeInTheDocument();
    expect(screen.getByText(/não possui recovery codes restantes/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /regener/i })).not.toBeInTheDocument();
    setup();
    expect(await screen.findByText(/ativo por SMS/i)).toBeInTheDocument();
    expect(screen.getByText(/Restam poucos recovery codes/i)).toBeInTheDocument();
  });

  it("enrolls by EMAIL/SMS, single-flights, resends, and keeps recovery codes visible when refetches fail", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    const request = vi
      .spyOn(twoFactorSecurityService, "requestEnrollment")
      .mockResolvedValue(challenge);
    vi.spyOn(twoFactorSecurityService, "confirmEnrollment").mockResolvedValue({
      recoveryCodes: codes,
    });
    const { queryClient } = setup(true, true);
    vi.spyOn(queryClient, "invalidateQueries").mockRejectedValue(new Error("refetch failed"));
    await screen.findByText(/Status: inativo/i);
    fireEvent.change(screen.getByLabelText(/Método/i), { target: { value: "SMS" } });
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    const button = screen.getByRole("button", { name: /Ativar 2FA/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByLabelText(/Código de seis dígitos/i);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ method: "SMS", currentPassword: "secret" });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    expect(await screen.findByText(codes[0])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar 2FA/i })).not.toBeInTheDocument();
    expect(JSON.stringify(queryClient.getQueryCache().getAll())).not.toContain(codes[0]);
    expect(JSON.stringify(queryClient.getMutationCache().getAll())).not.toContain(codes[0]);
    expect(JSON.stringify(localStorage)).not.toContain(codes[0]);
    expect(location.href).not.toContain(codes[0]);
    expect(JSON.stringify(mocks.toast)).not.toContain(codes[0]);
  });

  it("reconciles malformed enrollment before showing actions again", async () => {
    let enabled = false;
    vi.spyOn(twoFactorSecurityService, "getStatus").mockImplementation(async () => ({
      enabled,
      method: enabled ? "EMAIL" : null,
      enabledAt: enabled ? "2026-07-16T12:00:00.000Z" : null,
      recoveryCodesRemaining: enabled ? 10 : 0,
    }));
    vi.spyOn(twoFactorSecurityService, "requestEnrollment").mockResolvedValue(challenge);
    vi.spyOn(twoFactorSecurityService, "confirmEnrollment").mockRejectedValue(
      new ApiError(502, "MALFORMED_RESPONSE", "bad"),
    );
    setup();
    await screen.findByText(/Status: inativo/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Ativar 2FA/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    enabled = true;
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    expect(await screen.findByText(/pode ter sido ativado/i)).toBeInTheDocument();
    expect(await screen.findByText(/ativo por EMAIL/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar 2FA/i })).not.toBeInTheDocument();
  });

  it("keeps actions blocked when malformed enrollment reconciliation fails", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      })
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "internal"));
    vi.spyOn(twoFactorSecurityService, "requestEnrollment").mockResolvedValue(challenge);
    vi.spyOn(twoFactorSecurityService, "confirmEnrollment").mockRejectedValue(
      new ApiError(502, "MALFORMED_RESPONSE", "bad"),
    );
    setup();
    await screen.findByText(/Status: inativo/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Ativar 2FA/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    expect(await screen.findByText(/Não foi possível concluir/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar 2FA/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Tentar novamente/i })).toBeInTheDocument();
  });

  it("handles recovery-code screen, clipboard success/missing/rejection, and clears codes on close", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    vi.spyOn(twoFactorSecurityService, "requestEnrollment").mockResolvedValue(challenge);
    vi.spyOn(twoFactorSecurityService, "confirmEnrollment").mockResolvedValue({
      recoveryCodes: codes,
    });
    setup();
    await screen.findByText(/Status: inativo/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Ativar 2FA/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    await screen.findByText(codes[0]);
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(codes.join("\n")));
    expect(screen.getByText(/Códigos copiados/i)).toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    expect(await screen.findByText(/Não foi possível copiar/i)).toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    expect(await screen.findByText(/Clipboard indisponível/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar recovery codes/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmei/i));
    fireEvent.click(screen.getByRole("button", { name: /Fechar recovery codes/i }));
    await waitFor(() => expect(screen.queryByText(codes[0])).not.toBeInTheDocument());
  });

  it("disables by normalized recovery code or code, rejects invalid inputs, and clears auth on success", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue({
      enabled: true,
      method: "EMAIL",
      enabledAt: "2026-07-16T12:00:00.000Z",
      recoveryCodesRemaining: 9,
    });
    vi.spyOn(twoFactorSecurityService, "requestDisable").mockResolvedValue(challenge);
    const confirm = vi
      .spyOn(twoFactorSecurityService, "confirmDisable")
      .mockResolvedValue({ message: "done" });
    const { queryClient, authValue } = setup();
    queryClient.setQueryData(["auth", "private"], { secret: true });
    await screen.findByText(/Recovery codes restantes: 9/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByLabelText(/Entendo o risco/i));
    fireEvent.click(screen.getByRole("button", { name: /Solicitar desativação/i }));
    await screen.findByText(/Confirme com código/i);
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desativação/i }));
    expect(screen.getByText(/nunca ambos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Recovery code/i), {
      target: { value: "abcde12345fghij" },
    });
    expect(screen.getByLabelText(/Recovery code/i)).toHaveValue("ABCDE-12345-FGHIJ");
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desativação/i }));
    expect(screen.getByText(/nunca ambos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desativação/i }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({
        challengeId: challenge.challengeId,
        recoveryCode: "ABCDE-12345-FGHIJ",
      }),
    );
    expect(getAccessToken()).toBeNull();
    expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(queryClient.getQueryData(["auth", "private"])).toBeUndefined();
  });

  it("resends disable challenge with single-flight, preserves state on error, and avoids unmount updates", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue({
      enabled: true,
      method: "EMAIL",
      enabledAt: "2026-07-16T12:00:00.000Z",
      recoveryCodesRemaining: 9,
    });
    const request = vi
      .spyOn(twoFactorSecurityService, "requestDisable")
      .mockResolvedValueOnce(challenge)
      .mockResolvedValueOnce(nextChallenge)
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "internal"));
    vi.spyOn(twoFactorSecurityService, "confirmDisable").mockRejectedValue(
      new ApiError(400, "INVALID_RECOVERY_CODE", "bad"),
    );
    setup();
    await screen.findByText(/Recovery codes restantes: 9/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByLabelText(/Entendo o risco/i));
    fireEvent.click(screen.getByRole("button", { name: /Solicitar desativação/i }));
    await screen.findByText(/16\/07\/2026, 12:00:00|Confirme com código/i);
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    const resend = screen.getByRole("button", { name: /Reenviar código de desativação/i });
    fireEvent.click(resend);
    fireEvent.click(resend);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText(/^Código$/i)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.click(resend);
    await waitFor(() => expect(screen.getByText(/Não foi possível concluir/i)).toBeInTheDocument());
    expect(screen.getByLabelText(/^Código$/i)).toHaveValue("123456");

    const pending = deferred<typeof challenge>();
    request.mockReturnValueOnce(pending.promise);
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const view = setup();
    await screen.findByText(/Recovery codes restantes: 9/i);
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByLabelText(/Entendo o risco/i));
    fireEvent.click(screen.getByRole("button", { name: /Solicitar desativação/i }));
    view.unmount();
    pending.resolve(challenge);
    await Promise.resolve();
    expect(consoleError).not.toHaveBeenCalled();
  });
});
