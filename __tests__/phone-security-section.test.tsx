import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { phoneEmailSecurityService } from "@/services/auth/phoneEmailSecurity";
import { PhoneSecuritySection } from "@/components/account/security/PhoneSecuritySection";
import { isObviouslyBrazilianMobilePhone } from "@/components/account/security/phoneValidation";

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
  return { ...actual, useNavigate: () => mocks.navigate };
});

const auth = (): AuthContextValue => ({
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
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setup(strict = false) {
  cleanup();
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const authValue = auth();
  const ui = (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <PhoneSecuritySection phoneVerified={false} />
      </AuthContext.Provider>
    </QueryClientProvider>
  );
  const view = render(strict ? <React.StrictMode>{ui}</React.StrictMode> : ui);
  return { queryClient, authValue, unmount: view.unmount };
}

function mutationCacheText(queryClient: QueryClient) {
  return JSON.stringify(queryClient.getMutationCache().getAll());
}

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
  setAccessToken("access-token");
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("PhoneSecuritySection", () => {
  it("accepts valid Brazilian mobile numbers without stripping DDD 55", () => {
    expect(isObviouslyBrazilianMobilePhone("(17) 99999-1234")).toBe(true);
    expect(isObviouslyBrazilianMobilePhone("+55 (17) 99999-1234")).toBe(true);
    expect(isObviouslyBrazilianMobilePhone("(55) 99999-1234")).toBe(true);
    expect(isObviouslyBrazilianMobilePhone("+55 (55) 99999-1234")).toBe(true);
    expect(isObviouslyBrazilianMobilePhone("(17) 3333-1234")).toBe(false);
    expect(isObviouslyBrazilianMobilePhone("(17) 9999-1234")).toBe(false);
    expect(isObviouslyBrazilianMobilePhone("123")).toBe(false);
  });

  it("validates request fields and preserves empty initial flow after reload", () => {
    setup();
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    expect(screen.getByText("Informe o telefone.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/telefone celular/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    expect(screen.getByText("Informe um celular brasileiro válido.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    expect(screen.getByText("Informe a senha atual.")).toBeInTheDocument();
    cleanup();
    setup();
    expect(screen.queryByLabelText(/código sms/i)).not.toBeInTheDocument();
  });

  it("submits exact phone request once, enters challenge, clears input password, and keeps secrets out of URL/storage/mutation cache", async () => {
    const { queryClient } = setup();
    const request = vi
      .spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValue({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      });
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    const button = screen.getByRole("button", { name: /enviar código sms/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith({
      phone: "(17) 99999-1234",
      currentPassword: "current secret",
    });
    expect(await screen.findByLabelText(/código sms/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/senha da conta/i)).not.toBeInTheDocument();
    expect(location.href).not.toContain("99999");
    expect(location.href).not.toContain("11111111");
    expect(JSON.stringify(localStorage)).not.toContain("current secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("99999");
    expect(mutationCacheText(queryClient)).not.toContain("current secret");
    expect(mutationCacheText(queryClient)).not.toContain("11111111");
  });

  it("sends the original DDD 55 phone value without divergent normalization", async () => {
    setup();
    const request = vi
      .spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValue({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      });
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(55) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    expect(request).toHaveBeenCalledWith({
      phone: "(55) 99999-1234",
      currentPassword: "current secret",
    });
  });

  it("keeps fields on malformed request, SMS outage, rate limit, and does not create challenge", async () => {
    setup();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockRejectedValueOnce(new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API."))
      .mockRejectedValueOnce(new ApiError(503, "SMS_DELIVERY_UNAVAILABLE", "down"))
      .mockRejectedValueOnce(new ApiError(429, "PHONE_RESEND_COOLDOWN", "cooldown"));
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    for (const text of [
      "Resposta inválida da API.",
      "Entrega de SMS indisponível no momento.",
      "Aguarde antes de solicitar outro SMS.",
    ]) {
      fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
      expect(await screen.findByText(text)).toBeInTheDocument();
      expect(screen.getByDisplayValue("(17) 99999-1234")).toBeInTheDocument();
      expect(screen.queryByLabelText(/código sms/i)).not.toBeInTheDocument();
    }
  });

  it("validates and submits six-digit verification once, then clears auth and private queries", async () => {
    const { queryClient, authValue } = setup();
    queryClient.setQueryData(["auth", "private"], { secret: true });
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification").mockResolvedValue({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
      message: "sent",
    });
    const verify = vi
      .spyOn(phoneEmailSecurityService, "verifyPhone")
      .mockResolvedValue({ message: "ok" });
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await screen.findByLabelText(/código sms/i);
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar telefone/i }));
    expect(screen.getByText("Informe o código SMS de seis dígitos.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "１２３４５６" } });
    expect(screen.getByLabelText(/código sms/i)).toHaveValue("");
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "123456" } });
    const button = screen.getByRole("button", { name: /confirmar telefone/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(verify).toHaveBeenCalledTimes(1));
    expect(verify).toHaveBeenCalledWith({
      challengeId: "11111111-1111-4111-8111-111111111111",
      phone: "(17) 99999-1234",
      code: "123456",
    });
    await waitFor(() => expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(queryClient.getQueryData(["auth", "private"])).toBeUndefined();
  });

  it("preserves challenge on verify error and handles resend success/error without leaking to mutation cache", async () => {
    const { queryClient } = setup();
    const request = vi
      .spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockRejectedValueOnce(new ApiError(429, "PHONE_RESEND_COOLDOWN", "cooldown"))
      .mockResolvedValueOnce({
        challengeId: "22222222-2222-4222-8222-222222222222",
        expiresAt: "2026-07-16T12:30:00.000Z",
        message: "sent",
      });
    vi.spyOn(phoneEmailSecurityService, "verifyPhone").mockRejectedValue(
      new ApiError(400, "INVALID_OR_EXPIRED_CODE", "bad"),
    );
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await screen.findByText(/12:00/);
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar telefone/i }));
    expect(
      await screen.findByText("Código inválido, expirado ou já utilizado."),
    ).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
    const resend = screen.getByRole("button", { name: /reenviar sms/i });
    fireEvent.click(resend);
    fireEvent.click(resend);
    expect(await screen.findByText("Aguarde antes de solicitar outro SMS.")).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /reenviar sms/i }));
    expect(await screen.findByText(/12:30/)).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(3);
    expect(mutationCacheText(queryClient)).not.toContain("123456");
    expect(mutationCacheText(queryClient)).not.toContain("22222222");
  });

  it("keeps challenge controls disabled during resend and updates only after success", async () => {
    setup();
    const resend = deferred<{ challengeId: string; expiresAt: string; message: string }>();
    const request = vi
      .spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockReturnValueOnce(resend.promise);
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await screen.findByText(/12:00/);
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "654321" } });
    const resendButton = screen.getByRole("button", { name: /reenviar sms/i });
    fireEvent.click(resendButton);
    fireEvent.click(resendButton);
    expect(await screen.findByRole("button", { name: /reenviando/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /confirmar telefone/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /voltar/i })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: /voltar/i }));
    expect(screen.getByLabelText(/código sms/i)).toBeInTheDocument();
    expect(request).toHaveBeenCalledTimes(2);
    resend.resolve({
      challengeId: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2026-07-16T12:30:00.000Z",
      message: "sent",
    });
    expect(await screen.findByText(/12:30/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código sms/i)).toHaveValue("");
  });

  it("preserves challenge, expiration, and code when resend fails", async () => {
    setup();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockRejectedValueOnce(new ApiError(429, "PHONE_RESEND_COOLDOWN", "cooldown"));
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await screen.findByText(/12:00/);
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /reenviar sms/i }));
    expect(await screen.findByText("Aguarde antes de solicitar outro SMS.")).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código sms/i)).toHaveValue("654321");
  });

  it("creates the SMS challenge after a pending request resolves under StrictMode", async () => {
    setup(true);
    const pending = deferred<{ challengeId: string; expiresAt: string; message: string }>();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification").mockReturnValue(
      pending.promise,
    );
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    pending.resolve({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
      message: "sent",
    });
    expect(await screen.findByLabelText(/código sms/i)).toBeInTheDocument();
    expect(screen.getByText(/12:00/)).toBeInTheDocument();
  });

  it("updates resend challenge and clears old code after a pending resend resolves under StrictMode", async () => {
    setup(true);
    const resend = deferred<{ challengeId: string; expiresAt: string; message: string }>();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockReturnValueOnce(resend.promise);
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    await screen.findByText(/12:00/);
    fireEvent.change(screen.getByLabelText(/código sms/i), { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /reenviar sms/i }));
    resend.resolve({
      challengeId: "22222222-2222-4222-8222-222222222222",
      expiresAt: "2026-07-16T12:30:00.000Z",
      message: "sent",
    });
    expect(await screen.findByText(/12:30/)).toBeInTheDocument();
    expect(screen.getByLabelText(/código sms/i)).toHaveValue("");
  });

  it("does not update the visual flow when a pending request resolves after real unmount", async () => {
    const { unmount } = setup();
    const pending = deferred<{ challengeId: string; expiresAt: string; message: string }>();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification").mockReturnValue(
      pending.promise,
    );
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    unmount();
    pending.resolve({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
      message: "sent",
    });
    await waitFor(() => expect(screen.queryByLabelText(/código sms/i)).not.toBeInTheDocument());
    expect(consoleError).not.toHaveBeenCalled();
  });

  it("shows loading and disables resend while request is pending", async () => {
    setup();
    const pending = deferred<{ challengeId: string; expiresAt: string; message: string }>();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification").mockReturnValue(
      pending.promise,
    );
    fireEvent.change(screen.getByLabelText(/telefone celular/i), {
      target: { value: "(17) 99999-1234" },
    });
    fireEvent.change(screen.getByLabelText(/senha da conta/i), {
      target: { value: "current secret" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar código sms/i }));
    expect(await screen.findByRole("button", { name: /enviando sms/i })).toBeDisabled();
    pending.resolve({
      challengeId: "11111111-1111-4111-8111-111111111111",
      expiresAt: "2026-07-16T12:00:00.000Z",
      message: "sent",
    });
    expect(await screen.findByRole("button", { name: /reenviar sms/i })).toBeEnabled();
  });
});
