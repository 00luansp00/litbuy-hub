import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import type { AuthDevice, AuthSession, AuthUser } from "@/services/auth";
import { authSecurityService } from "@/services/auth/security";

const navigate = vi.fn();
const toast = { error: vi.fn(), success: vi.fn(), info: vi.fn() };
vi.mock("sonner", () => ({ toast }));
vi.mock("@tanstack/react-router", async () => {
  const actual =
    await vi.importActual<typeof import("@tanstack/react-router")>("@tanstack/react-router");
  return {
    ...actual,
    createFileRoute: () => (options: Record<string, unknown>) => options,
    useNavigate: () => navigate,
    Link: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    useRouterState: () => "/perfil/seguranca",
  };
});

const user: AuthUser = {
  id: "u",
  email: "user@example.com",
  emailVerified: true,
  phoneVerified: false,
  birthDate: "2000-01-01T00:00:00.000Z",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  displayName: "user",
  name: "user",
};
const auth: AuthContextValue = {
  user,
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

const session = (overrides: Partial<AuthSession> = {}): AuthSession => ({
  id: "s1",
  deviceId: "d1",
  deviceName: "Notebook",
  userAgent: "Firefox",
  createdAt: "2026-07-16T10:00:00.000Z",
  lastUsedAt: "2026-07-16T11:00:00.000Z",
  expiresAt: "2026-08-16T10:00:00.000Z",
  current: false,
  revoked: false,
  revokedAt: null,
  revocationReason: null,
  ...overrides,
});

const device = (overrides: Partial<AuthDevice> = {}): AuthDevice => ({
  id: "d1",
  displayName: "Notebook",
  userAgent: "Firefox",
  status: "APPROVED",
  isInitialDevice: true,
  approvedAt: "2026-07-16T09:00:00.000Z",
  firstSeenAt: "2026-07-16T09:00:00.000Z",
  lastSeenAt: "2026-07-16T11:00:00.000Z",
  revokedAt: null,
  current: false,
  ...overrides,
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

async function setup() {
  cleanup();
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const mod = await import("../src/routes/perfil.seguranca");
  render(
    <QueryClientProvider client={qc}>
      <AuthContext.Provider value={auth}>
        {React.createElement(mod.Route.component)}
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return qc;
}

function mockLists(sessions: AuthSession[] = [], devices: AuthDevice[] = []) {
  vi.spyOn(authSecurityService, "listSessions").mockResolvedValue({ sessions });
  vi.spyOn(authSecurityService, "listDevices").mockResolvedValue({ devices });
}

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  toast.info.mockReset();
  auth.clearAuthentication = vi.fn();
  setAccessToken("page-access-token");
});

describe("account security center", () => {
  it("shows loading, real sessions/devices and current markers", async () => {
    mockLists([session({ current: true })], [device({ current: true })]);
    await setup();
    expect(screen.getAllByText(/carregando dados reais/i).length).toBeGreaterThan(0);
    expect(await screen.findAllByText("Notebook")).toHaveLength(2);
    expect(screen.getByText("Sessão atual")).toBeInTheDocument();
    expect(screen.getByText("Dispositivo atual")).toBeInTheDocument();
  });

  it("renders empty and safe error states and disables destructive logout-all on list error", async () => {
    vi.spyOn(authSecurityService, "listSessions").mockRejectedValue(new Error("boom"));
    vi.spyOn(authSecurityService, "listDevices").mockRejectedValue(new Error("boom"));
    await setup();
    expect(await screen.findAllByText(/não foi possível conectar/i)).toHaveLength(2);
    expect(screen.getByRole("button", { name: /encerrar todas as sessões/i })).toBeDisabled();
  });

  it("revokes another session with confirmation, invalidates and keeps auth", async () => {
    mockLists([session({ id: "s2", deviceName: "Celular", userAgent: "Chrome" })], []);
    const revoke = vi
      .spyOn(authSecurityService, "revokeSession")
      .mockResolvedValue({ message: "ok" });
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar sessão/i }));
    expect(screen.getByText("Esta sessão será encerrada.")).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /confirmar/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(revoke).toHaveBeenCalledTimes(1));
    expect(revoke).toHaveBeenCalledWith("s2", expect.anything());
    expect(toast.success).toHaveBeenCalledWith("Sessão revogada.");
    expect(auth.clearAuthentication).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith({ to: "/login" });
  });

  it("revokes the current session and clears auth state", async () => {
    mockLists([session({ id: "current-session", current: true })], []);
    vi.spyOn(authSecurityService, "revokeSession").mockResolvedValue({ message: "ok" });
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar sessão/i }));
    expect(
      screen.getByText("Esta sessão será encerrada e você voltará ao login."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(auth.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });

  it("revokes another device and keeps auth", async () => {
    mockLists([], [device({ id: "other-device", displayName: "Tablet" })]);
    const revoke = vi
      .spyOn(authSecurityService, "revokeDevice")
      .mockResolvedValue({ message: "ok" });
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar dispositivo/i }));
    expect(
      screen.getByText(
        "Este dispositivo precisará ser aprovado novamente para criar novas sessões.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(revoke).toHaveBeenCalledWith("other-device", expect.anything()));
    expect(auth.clearAuthentication).not.toHaveBeenCalled();
    expect(toast.success).toHaveBeenCalledWith("Dispositivo revogado.");
  });

  it("revokes the current device and clears auth state", async () => {
    mockLists([], [device({ id: "current-device", current: true })]);
    vi.spyOn(authSecurityService, "revokeDevice").mockResolvedValue({ message: "ok" });
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar dispositivo/i }));
    expect(
      screen.getByText(
        "Este dispositivo precisará ser aprovado novamente e sua sessão pode ser encerrada.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(auth.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });

  it("uses logout-all copy, warns current session ends, blocks double click and clears auth", async () => {
    mockLists([session({ current: true })], []);
    const logoutAll = vi
      .spyOn(authSecurityService, "logoutAllSessions")
      .mockResolvedValue({ message: "ok" });
    await setup();
    await screen.findByText("Sessão atual");
    expect(screen.queryByText(/outras sessões/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /encerrar todas as sessões/i }));
    expect(screen.getAllByText("Encerrar todas as sessões").length).toBeGreaterThan(1);
    expect(
      screen.getByText(
        "Todas as sessões, incluindo esta, serão encerradas. Será necessário entrar novamente em um dispositivo aprovado.",
      ),
    ).toBeInTheDocument();
    const confirm = screen.getByRole("button", { name: /confirmar/i });
    fireEvent.click(confirm);
    fireEvent.click(confirm);
    await waitFor(() => expect(logoutAll).toHaveBeenCalledTimes(1));
    expect(auth.clearAuthentication).toHaveBeenCalledTimes(1);
    expect(getAccessToken()).toBeNull();
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
    expect(toast.info).toHaveBeenCalledWith(
      "Todas as sessões foram encerradas e você foi desconectado.",
    );
  });

  it("keeps auth and modal available when revocation fails", async () => {
    mockLists([session({ id: "s-fail" })], []);
    vi.spyOn(authSecurityService, "revokeSession").mockRejectedValue(
      new ApiError(429, "RATE_LIMITED", "rate"),
    );
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar sessão/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Muitas tentativas. Aguarde alguns minutos."),
    );
    expect(auth.clearAuthentication).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith({ to: "/login" });
    expect(screen.getByRole("button", { name: /confirmar/i })).toBeEnabled();
  });

  it("keeps password fields during pending and clears them only after successful password change", async () => {
    mockLists([], []);
    const change = deferred<{ message: string }>();
    const changeSpy = vi
      .spyOn(authSecurityService, "changePassword")
      .mockReturnValue(change.promise);
    await setup();
    fireEvent.change(screen.getByLabelText(/senha atual/i), {
      target: { value: "current password" },
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new password 123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nova senha/i), {
      target: { value: "new password 123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /alterar senha/i }));
    await waitFor(() => expect(changeSpy).toHaveBeenCalledTimes(1));
    expect(changeSpy).toHaveBeenCalledWith({
      currentPassword: "current password",
      newPassword: "new password 123",
    });
    expect(screen.getByLabelText(/senha atual/i)).toHaveValue("current password");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("new password 123");
    expect(screen.getByRole("button", { name: /alterando senha/i })).toBeDisabled();
    change.resolve({ message: "ok" });
    await waitFor(() => expect(auth.clearAuthentication).toHaveBeenCalledTimes(1));
    expect(screen.getByLabelText(/senha atual/i)).toHaveValue("");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("");
    expect(screen.getByLabelText(/confirmar nova senha/i)).toHaveValue("");
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
  });

  it("preserves password fields and auth on invalid current password", async () => {
    mockLists([], []);
    vi.spyOn(authSecurityService, "changePassword").mockRejectedValue(
      new ApiError(401, "INVALID_CREDENTIALS", "invalid"),
    );
    await setup();
    fireEvent.change(screen.getByLabelText(/senha atual/i), {
      target: { value: "wrong password" },
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new password 123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nova senha/i), {
      target: { value: "new password 123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /alterar senha/i }));
    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("E-mail ou senha inválidos."));
    expect(screen.getByLabelText(/senha atual/i)).toHaveValue("wrong password");
    expect(screen.getByLabelText("Nova senha")).toHaveValue("new password 123");
    expect(auth.clearAuthentication).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalledWith({ to: "/login" });
  });

  it("preserves password fields after rate limit and allows a second attempt", async () => {
    mockLists([], []);
    const changeSpy = vi
      .spyOn(authSecurityService, "changePassword")
      .mockRejectedValueOnce(new ApiError(429, "RATE_LIMITED", "rate"))
      .mockRejectedValueOnce(new ApiError(503, "HTTP_ERROR", "unavailable"));
    await setup();
    fireEvent.change(screen.getByLabelText(/senha atual/i), {
      target: { value: "current password" },
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new password 123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nova senha/i), {
      target: { value: "new password 123" },
    });
    const button = screen.getByRole("button", { name: /alterar senha/i });
    fireEvent.click(button);
    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Muitas tentativas. Aguarde alguns minutos."),
    );
    expect(button).toBeEnabled();
    expect(screen.getByLabelText(/senha atual/i)).toHaveValue("current password");
    fireEvent.click(button);
    await waitFor(() => expect(changeSpy).toHaveBeenCalledTimes(2));
    expect(screen.getByLabelText("Nova senha")).toHaveValue("new password 123");
  });

  it("single-flights password submit while the mutation is pending", async () => {
    mockLists([], []);
    const change = deferred<{ message: string }>();
    const changeSpy = vi
      .spyOn(authSecurityService, "changePassword")
      .mockReturnValue(change.promise);
    await setup();
    fireEvent.change(screen.getByLabelText(/senha atual/i), {
      target: { value: "current password" },
    });
    fireEvent.change(screen.getByLabelText("Nova senha"), {
      target: { value: "new password 123" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar nova senha/i), {
      target: { value: "new password 123" },
    });
    const button = screen.getByRole("button", { name: /alterar senha/i });
    fireEvent.click(button);
    fireEvent.click(button);
    await waitFor(() => expect(changeSpy).toHaveBeenCalledTimes(1));
    change.resolve({ message: "ok" });
    await waitFor(() => expect(auth.clearAuthentication).toHaveBeenCalledTimes(1));
  });
});
