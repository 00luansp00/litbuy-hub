import React from "react";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { TwoFactorSecuritySection } from "@/components/account/security/TwoFactorSecuritySection";
import { accountSecurityQueryKeys } from "@/services/auth/useAccountSecurity";
import { stepUpSecurityService } from "@/services/auth/stepUpSecurity";
import { twoFactorMethodChangeService } from "@/services/auth/twoFactorMethodChange";
import { twoFactorSecurityService } from "@/services/auth/twoFactorSecurity";

const routerMocks = vi.hoisted(() => ({ navigate: vi.fn() }));
vi.mock("@tanstack/react-router", async () => ({
  ...(await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router")),
  useNavigate: () => routerMocks.navigate,
}));

const stepUpChallenge = {
  challengeId: "123e4567-e89b-42d3-8456-426614174000",
  scope: "TWO_FACTOR_METHOD_CHANGE" as const,
  method: "EMAIL" as const,
  expiresAt: "2027-07-16T12:00:00.000Z",
};
const changeChallenge = {
  challengeId: "223e4567-e89b-42d3-8456-426614174001",
  expiresAt: "2027-07-16T12:05:00.000Z",
};
const enabledEmail = {
  enabled: true,
  method: "EMAIL" as const,
  enabledAt: "2026-07-16T12:00:00.000Z",
  recoveryCodesRemaining: 3,
};
const enabledSms = { ...enabledEmail, method: "SMS" as const };

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
function SessionsProbe({ queryFn }: { queryFn: ReturnType<typeof vi.fn> }) {
  useQuery({ queryKey: accountSecurityQueryKeys.sessions, queryFn, retry: false });
  return null;
}
function setup(
  options: { smsAvailable?: boolean; sessionsQueryFn?: ReturnType<typeof vi.fn> } = {},
) {
  cleanup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const sessionsQueryFn = options.sessionsQueryFn ?? vi.fn().mockResolvedValue([]);
  const view = render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={auth()}>
        <SessionsProbe queryFn={sessionsQueryFn} />
        <TwoFactorSecuritySection smsAvailable={options.smsAvailable ?? true} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient, sessionsQueryFn, ...view };
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  vi.setSystemTime(new Date("2026-07-17T00:00:00.000Z"));
  vi.restoreAllMocks();
  vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue(enabledEmail);
  vi.spyOn(stepUpSecurityService, "requestMethodChangeStepUp").mockResolvedValue(stepUpChallenge);
  vi.spyOn(stepUpSecurityService, "verifyMethodChangeStepUp").mockResolvedValue({
    stepUpToken: "opaque-step-up-token-value",
    scope: "TWO_FACTOR_METHOD_CHANGE",
    expiresAt: "2027-07-16T12:10:00.000Z",
  });
  vi.spyOn(stepUpSecurityService, "resendMethodChangeStepUp").mockResolvedValue({
    ...stepUpChallenge,
    challengeId: "323e4567-e89b-42d3-8456-426614174002",
  });
  vi.spyOn(twoFactorMethodChangeService, "request").mockResolvedValue(changeChallenge);
  vi.spyOn(twoFactorMethodChangeService, "confirm").mockResolvedValue({ methodChanged: true });
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

afterEach(() => {
  vi.useRealTimers();
});

async function completeStepUp() {
  await screen.findByRole("button", { name: /Alterar método de 2FA/i });
  fireEvent.click(screen.getByLabelText(/autorizo a troca segura/i));
  fireEvent.click(screen.getByRole("button", { name: /Alterar método de 2FA/i }));
  fireEvent.change(await screen.findByLabelText(/Senha atual/i), { target: { value: "secret" } });
  fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
  await screen.findByLabelText(/Código de seis dígitos/i);
  fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
    target: { value: "123456" },
  });
  fireEvent.click(screen.getByRole("button", { name: /Confirmar step-up/i }));
  return screen.findByLabelText(/Novo método/i);
}

describe("TwoFactorMethodChange", () => {
  it("does not self-disable during exclusive flow and blocks other 2FA actions", async () => {
    setup();
    await completeStepUp();
    expect(screen.getByRole("button", { name: /Enviar código ao novo método/i })).toBeEnabled();
    expect(
      screen.queryByRole("button", { name: /Regenerar recovery codes/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Solicitar desativação/i }),
    ).not.toBeInTheDocument();
  });

  it("reconciles status and sessions before showing success", async () => {
    const statusSpy = vi
      .spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockResolvedValueOnce(enabledSms);
    const sessionsQueryFn = vi.fn().mockResolvedValue([]);
    setup({ sessionsQueryFn });
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    await screen
      .findByLabelText(/method-change-code/i, {}, { timeout: 1000 })
      .catch(() => undefined);
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    await screen.findByText(/Método de 2FA atualizado/i);
    expect(statusSpy).toHaveBeenCalledTimes(2);
    expect(sessionsQueryFn).toHaveBeenCalledTimes(2);
    expect(await screen.findByText(/ativo por SMS/i)).toBeInTheDocument();
  });

  it("preserves challenge on rate-limited resend and updates it on success", async () => {
    const resend = vi
      .spyOn(stepUpSecurityService, "resendMethodChangeStepUp")
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "slow"))
      .mockResolvedValueOnce({ ...stepUpChallenge, method: "SMS" });
    setup();
    await screen.findByRole("button", { name: /Alterar método de 2FA/i });
    fireEvent.click(screen.getByLabelText(/autorizo a troca segura/i));
    fireEvent.click(screen.getByRole("button", { name: /Alterar método de 2FA/i }));
    fireEvent.change(await screen.findByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByText(/Código enviado por e-mail/i);
    fireEvent.click(screen.getByRole("button", { name: /Reenviar step-up/i }));
    expect(await screen.findByText(/Muitas tentativas/i)).toBeInTheDocument();
    expect(screen.getByText(/Código enviado por e-mail/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Reenviar step-up/i }));
    expect(await screen.findByText(/Código enviado por SMS/i)).toBeInTheDocument();
    expect(resend).toHaveBeenCalledTimes(2);
  });

  it("keeps actions blocked after ambiguous confirm until reconciliation retry succeeds", async () => {
    vi.spyOn(twoFactorMethodChangeService, "confirm").mockRejectedValueOnce(
      new ApiError(502, "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN", "unknown"),
    );
    const statusSpy = vi
      .spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "down"))
      .mockResolvedValueOnce(enabledSms);
    setup();
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/pode ter sido aplicada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível concluir a operação/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Regenerar recovery codes/i }),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    await screen.findByText(/Status da segurança atualizado/i);
    await screen.findByText(/ativo por SMS/i);
    await waitFor(() =>
      expect(screen.queryByText(/pode ter sido aplicada/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/Não foi possível concluir a operação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Método de 2FA atualizado/i)).not.toBeInTheDocument();
    expect(statusSpy).toHaveBeenCalledTimes(3);
  });

  it("clears stale ambiguous warning after a successful reconciliation retry", async () => {
    vi.spyOn(twoFactorMethodChangeService, "confirm").mockRejectedValueOnce(
      new ApiError(502, "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN", "unknown"),
    );
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "down"))
      .mockResolvedValueOnce(enabledSms);
    setup();
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/pode ter sido aplicada/i)).toBeInTheDocument();
    expect(await screen.findByText(/Não foi possível concluir a operação/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    expect(await screen.findByText(/Status da segurança atualizado/i)).toBeInTheDocument();
    expect(await screen.findByText(/ativo por SMS/i)).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText(/pode ter sido aplicada/i)).not.toBeInTheDocument(),
    );
    expect(screen.queryByText(/Não foi possível concluir a operação/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Método de 2FA atualizado/i)).not.toBeInTheDocument();
  });

  it("keeps confirmed changes blocked when status reconciliation fails, then retries", async () => {
    const statusSpy = vi
      .spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "down"))
      .mockResolvedValueOnce(enabledSms);
    setup();
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/Não foi possível concluir/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Regenerar recovery codes/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Confirmar troca/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    await screen.findByText(/Método de 2FA atualizado/i);
    expect(statusSpy).toHaveBeenCalledTimes(3);
  });

  it("keeps confirmed changes blocked when sessions reconciliation fails, then retries", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockResolvedValue(enabledSms);
    const sessionsQueryFn = vi
      .fn()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "sessions down"))
      .mockResolvedValueOnce([]);
    setup({ sessionsQueryFn });
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/Não foi possível concluir/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tentar reconciliar novamente/i }));
    await screen.findByText(/Método de 2FA atualizado/i);
    expect(sessionsQueryFn).toHaveBeenCalledTimes(3);
  });

  it("does not declare success when confirmed status still shows the previous method", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue(enabledEmail);
    setup();
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/status ainda não confirmou/i)).toBeInTheDocument();
    expect(screen.queryByText(/Método de 2FA atualizado/i)).not.toBeInTheDocument();
  });

  it("uses neutral copy after ambiguous reconciliation regardless of returned method", async () => {
    vi.spyOn(twoFactorMethodChangeService, "confirm").mockRejectedValueOnce(
      new ApiError(502, "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN", "unknown"),
    );
    vi.spyOn(twoFactorSecurityService, "getStatus")
      .mockResolvedValueOnce(enabledEmail)
      .mockResolvedValueOnce(enabledEmail);
    setup();
    await completeStepUp();
    fireEvent.click(screen.getByRole("button", { name: /Enviar código ao novo método/i }));
    fireEvent.change(await screen.findByLabelText(/Código de seis dígitos/i), {
      target: { value: "654321" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar troca/i }));
    expect(await screen.findByText(/Status da segurança atualizado/i)).toBeInTheDocument();
    expect(screen.queryByText(/Método de 2FA atualizado/i)).not.toBeInTheDocument();
    expect(await screen.findByText(/ativo por EMAIL/i)).toBeInTheDocument();
  });

  it("clears step-up challenge on resend delivery unavailable or expired challenge", async () => {
    vi.spyOn(stepUpSecurityService, "resendMethodChangeStepUp")
      .mockRejectedValueOnce(new ApiError(503, "STEP_UP_DELIVERY_UNAVAILABLE", "down"))
      .mockRejectedValueOnce(new ApiError(400, "INVALID_OR_EXPIRED_STEP_UP_CODE", "expired"));
    setup();
    await screen.findByRole("button", { name: /Alterar método de 2FA/i });
    fireEvent.click(screen.getByLabelText(/autorizo a troca segura/i));
    fireEvent.click(screen.getByRole("button", { name: /Alterar método de 2FA/i }));
    fireEvent.change(await screen.findByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByText(/Código enviado por e-mail/i);
    fireEvent.click(screen.getByRole("button", { name: /Reenviar step-up/i }));
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Senha atual/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Solicitar step-up/i }));
    await screen.findByText(/Código enviado por e-mail/i);
    fireEvent.click(screen.getByRole("button", { name: /Reenviar step-up/i }));
    expect(await screen.findByLabelText(/Senha atual/i)).toBeInTheDocument();
  });

  it("does not offer method change for inactive 2FA or unavailable SMS", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValueOnce({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    setup();
    await screen.findByText(/Status: inativo/i);
    expect(screen.queryByRole("button", { name: /Alterar método/i })).not.toBeInTheDocument();

    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValueOnce(enabledEmail);
    setup({ smsAvailable: false });
    await screen.findByText(/Nenhum método alternativo disponível/i);
  });

  it("does not expose technical scope, grant wording, regex text, or secrets in the UI/storage", async () => {
    setup();
    await completeStepUp();
    expect(document.body.textContent).not.toContain("TWO_FACTOR_METHOD_CHANGE");
    expect(document.body.textContent).not.toContain("grant opaco");
    expect(document.body.textContent).not.toContain("[A-Z0-9]");
    expect(document.body.textContent).not.toContain("opaque-step-up-token-value");
    expect(JSON.stringify(localStorage)).not.toContain("opaque-step-up-token-value");
    expect(JSON.stringify(sessionStorage)).not.toContain("opaque-step-up-token-value");
  });
});
