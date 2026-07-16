import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AuthContextValue } from "@/providers/AuthContext";

let mockSearch: Record<string, unknown> = {};
const navigate = vi.fn();
const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
let auth: AuthContextValue;

vi.mock("sonner", () => ({ toast }));
vi.mock("@/providers/AuthContext", () => ({ useAuth: () => auth }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => mockSearch,
  }),
  Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
  useNavigate: () => navigate,
}));

const baseAuth = (): AuthContextValue => ({
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
  switchToBuyer: vi.fn(),
  switchToSeller: vi.fn(() => ({ ok: true, needsOnboarding: false })),
  toggleRole: vi.fn(() => ({ ok: true, needsOnboarding: false, role: "buyer" })),
});

async function renderRoute(path: string) {
  vi.resetModules();
  const mod = await import(path);
  return render(React.createElement(mod.Route.component));
}

beforeEach(() => {
  auth = baseAuth();
  mockSearch = {};
  navigate.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  toast.info.mockReset();
});

describe("login route", () => {
  it("navigates home on authenticated login and never puts email in search", async () => {
    auth.login = vi
      .fn()
      .mockResolvedValue({ status: "authenticated", user: { displayName: "user" } });
    await renderRoute("../src/routes/login");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha", { selector: "input" }), {
      target: { value: "passwordpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/" }));
    expect(JSON.stringify(navigate.mock.calls)).not.toContain("user@example.com");
  });

  it("routes challenges and email verification without navigating home", async () => {
    auth.login = vi.fn().mockResolvedValueOnce({ status: "deviceApprovalRequired" });
    await renderRoute("../src/routes/login");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha", { selector: "input" }), {
      target: { value: "passwordpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/verificacao-login",
        search: { mode: "device", token: undefined },
      }),
    );
    expect(navigate).not.toHaveBeenCalledWith({ to: "/" });
  });

  it("routes 2FA and EMAIL_NOT_VERIFIED safely", async () => {
    auth.login = vi
      .fn()
      .mockResolvedValueOnce({ status: "twoFactorRequired" })
      .mockResolvedValueOnce({ status: "emailVerificationRequired" });
    await renderRoute("../src/routes/login");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "user@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha", { selector: "input" }), {
      target: { value: "passwordpassword" },
    });
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/verificacao-login",
        search: { mode: "2fa", token: undefined },
      }),
    );
    fireEvent.click(screen.getByRole("button", { name: /entrar/i }));
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/verificar-email",
        search: { token: undefined },
      }),
    );
    expect(JSON.stringify(navigate.mock.calls)).not.toContain("user@example.com");
  });
});

describe("register route", () => {
  it("rejects invalid local fields and submits exact valid payload without email URL", async () => {
    auth.register = vi.fn().mockResolvedValue(undefined);
    await renderRoute("../src/routes/cadastro");
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Senha", { selector: "input" }), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(toast.error).toHaveBeenCalledWith("A senha precisa ter pelo menos 12 caracteres.");
    fireEvent.change(screen.getByLabelText("Senha", { selector: "input" }), {
      target: { value: "passwordpass" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: "passwordpass" },
    });
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
      target: { value: "2008-07-17" },
    });
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    expect(toast.error).toHaveBeenCalledWith("É necessário ter pelo menos 18 anos.");
    fireEvent.change(screen.getByLabelText(/data de nascimento/i), {
      target: { value: "2008-07-16" },
    });
    fireEvent.click(screen.getByRole("checkbox", { name: /termos/i }));
    fireEvent.click(screen.getByRole("checkbox", { name: /privacidade/i }));
    fireEvent.click(screen.getByRole("button", { name: /criar conta/i }));
    await waitFor(() =>
      expect(auth.register).toHaveBeenCalledWith(
        expect.objectContaining({
          email: "new@example.com",
          password: "passwordpass",
          termsAccepted: true,
          privacyAccepted: true,
        }),
      ),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/verificar-email", search: { token: undefined } });
    expect(JSON.stringify(navigate.mock.calls)).not.toContain("new@example.com");
  });
});

describe("verification routes", () => {
  it("verifies email token once and removes router search token", async () => {
    mockSearch = { token: "email-token" };
    auth.verifyEmail = vi.fn().mockResolvedValue(undefined);
    const rendered = await renderRoute("../src/routes/verificar-email");
    await waitFor(() => expect(auth.verifyEmail).toHaveBeenCalledTimes(1));
    rendered.rerender(
      React.createElement((await import("../src/routes/verificar-email")).Route.component),
    );
    expect(auth.verifyEmail).toHaveBeenCalledTimes(1);
    expect(auth.verifyEmail).toHaveBeenCalledWith("email-token");
    await waitFor(() => expect(screen.getByText(/e-mail confirmado/i)).toBeInTheDocument());
    expect(navigate).toHaveBeenCalledWith({
      to: "/verificar-email",
      search: { token: undefined },
      replace: true,
    });
  });

  it("approves device token once only in mode=device and never in mode=2fa", async () => {
    mockSearch = { mode: "device", token: "device-token" };
    auth.approveDevice = vi.fn().mockResolvedValue(undefined);
    const rendered = await renderRoute("../src/routes/verificacao-login");
    await waitFor(() => expect(auth.approveDevice).toHaveBeenCalledTimes(1));
    rendered.rerender(
      React.createElement((await import("../src/routes/verificacao-login")).Route.component),
    );
    expect(auth.approveDevice).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({
      to: "/verificacao-login",
      search: { mode: "device", token: undefined },
      replace: true,
    });

    vi.resetModules();
    mockSearch = { mode: "2fa", token: "device-token" };
    auth.approveDevice = vi.fn().mockResolvedValue(undefined);
    await renderRoute("../src/routes/verificacao-login");
    expect(auth.approveDevice).not.toHaveBeenCalled();
    expect(screen.getByText(/tentativa de 2FA expirou/i)).toBeInTheDocument();
  });

  it("validates 2FA code and recovery payloads before submit", async () => {
    mockSearch = { mode: "2fa" };
    auth.twoFactorChallenge = {
      status: "twoFactorRequired",
      challengeId: "id",
      method: "EMAIL",
      expiresAt: "2026-07-16T00:00:00.000Z",
    };
    auth.verifyTwoFactorLogin = vi.fn().mockResolvedValue({ email: "user@example.com" });
    await renderRoute("../src/routes/verificacao-login");
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "123" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar 2fa/i }));
    expect(toast.error).toHaveBeenCalledWith("Informe um código de seis dígitos.");
    fireEvent.change(screen.getByLabelText(/código/i), { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /confirmar 2fa/i }));
    await waitFor(() => expect(auth.verifyTwoFactorLogin).toHaveBeenCalledWith({ code: "123456" }));
    expect(navigate).toHaveBeenCalledWith({ to: "/" });
  });
});

describe("password routes", () => {
  it("forgot password presents generic success", async () => {
    auth.requestPasswordReset = vi.fn().mockResolvedValue(undefined);
    await renderRoute("../src/routes/recuperar-senha");
    fireEvent.change(screen.getByLabelText(/email cadastrado/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /enviar instruções/i }));
    await waitFor(() => expect(screen.getByText(/se existir uma conta/i)).toBeInTheDocument());
  });

  it("reset captures token, removes search, validates password and returns login", async () => {
    mockSearch = { token: "reset-token" };
    auth.resetPassword = vi.fn().mockResolvedValue(undefined);
    await renderRoute("../src/routes/redefinir-senha");
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith({
        to: "/redefinir-senha",
        search: { token: undefined },
        replace: true,
      }),
    );
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: "short" } });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));
    expect(toast.error).toHaveBeenCalledWith("A senha precisa ter pelo menos 12 caracteres.");
    fireEvent.change(screen.getByLabelText(/nova senha/i), { target: { value: "passwordpass" } });
    fireEvent.change(screen.getByLabelText(/confirmar senha/i), {
      target: { value: "passwordpass" },
    });
    fireEvent.click(screen.getByRole("button", { name: /redefinir senha/i }));
    await waitFor(() =>
      expect(auth.resetPassword).toHaveBeenCalledWith("reset-token", "passwordpass"),
    );
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });
});
