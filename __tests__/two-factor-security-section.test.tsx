import React, { StrictMode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

const challenge = {
  challengeId: "123e4567-e89b-42d3-a456-426614174000",
  expiresAt: "2026-07-16T12:00:00.000Z",
  message: "sent",
};
const codes = Array.from({ length: 10 }, (_, index) => `ABCD-EF${index}1-GH${index}2`);

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
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue = auth();
  const element = <TwoFactorSecuritySection smsAvailable={smsAvailable} />;
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        {strict ? <StrictMode>{element}</StrictMode> : element}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient, authValue };
}

beforeEach(() => {
  vi.restoreAllMocks();
  mocks.navigate.mockReset();
  mocks.toast.error.mockReset();
  mocks.toast.info.mockReset();
  setAccessToken("access-token");
  localStorage.clear();
  sessionStorage.clear();
});

describe("TwoFactorSecuritySection", () => {
  it("shows loading, status, EMAIL enrollment, single-flight resend and recovery codes before refetch", async () => {
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
    setup(true, true);
    expect(screen.getByText(/Carregando status real/i)).toBeInTheDocument();
    expect(await screen.findByText(/Status: inativo/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    const button = screen.getByRole("button", { name: /Ativar 2FA/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByLabelText(/Código de seis dígitos/i);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({ method: "EMAIL", currentPassword: "secret" });
    fireEvent.click(screen.getByRole("button", { name: /Reenviar código/i }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(2));
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    expect(await screen.findByText(codes[0])).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Ativar 2FA/i })).not.toBeInTheDocument();
  });

  it("handles SMS unavailable, required password, malformed response status refetch and clipboard states", async () => {
    vi.spyOn(twoFactorSecurityService, "getStatus").mockResolvedValue({
      enabled: false,
      method: null,
      enabledAt: null,
      recoveryCodesRemaining: 0,
    });
    vi.spyOn(twoFactorSecurityService, "requestEnrollment").mockResolvedValue(challenge);
    vi.spyOn(twoFactorSecurityService, "confirmEnrollment").mockRejectedValue(
      new ApiError(502, "MALFORMED_RESPONSE", "bad"),
    );
    setup(false);
    await screen.findByText(/Status: inativo/i);
    fireEvent.click(screen.getByRole("button", { name: /Ativar 2FA/i }));
    expect(screen.getByText(/Informe a senha atual/i)).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /SMS indisponível/i })).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Senha da conta/i), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: /Ativar 2FA/i }));
    await screen.findByLabelText(/Código de seis dígitos/i);
    fireEvent.change(screen.getByLabelText(/Código de seis dígitos/i), {
      target: { value: "123456" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar ativação/i }));
    expect(await screen.findByText(/pode ter sido ativado/i)).toBeInTheDocument();
  });

  it("copies recovery codes only by click and handles unavailable clipboard", async () => {
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
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    await waitFor(() => expect(writeText).toHaveBeenCalledWith(codes.join("\n")));
    expect(screen.getByText(/Códigos copiados/i)).toBeInTheDocument();
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
    fireEvent.click(screen.getByRole("button", { name: /Copiar todos/i }));
    expect(await screen.findByText(/Clipboard indisponível/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Fechar recovery codes/i })).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/Confirmei/i));
    fireEvent.click(screen.getByRole("button", { name: /Fechar recovery codes/i }));
    await waitFor(() => expect(screen.queryByText(codes[0])).not.toBeInTheDocument());
  });

  it("disables by code or recovery, rejects both or none, and clears authentication on success", async () => {
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
    fireEvent.change(screen.getByLabelText(/^Código$/i), { target: { value: "123456" } });
    fireEvent.change(screen.getByLabelText(/Recovery code/i), {
      target: { value: "ABCD-EF01-GH02" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desativação/i }));
    expect(screen.getByText(/nunca ambos/i)).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Recovery code/i), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /Confirmar desativação/i }));
    await waitFor(() =>
      expect(confirm).toHaveBeenCalledWith({ challengeId: challenge.challengeId, code: "123456" }),
    );
    expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1);
    expect(mocks.navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(queryClient.getQueryData(["auth", "private"])).toBeUndefined();
  });
});
