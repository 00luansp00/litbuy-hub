import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import type { AuthUser } from "@/services/auth";
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

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockReset();
  toast.error.mockReset();
  toast.success.mockReset();
  toast.info.mockReset();
  auth.clearAuthentication = vi.fn();
});

describe("account security center", () => {
  it("shows loading, real sessions/devices and current markers", async () => {
    vi.spyOn(authSecurityService, "listSessions").mockResolvedValue({
      sessions: [
        {
          id: "s1",
          deviceId: "d1",
          deviceName: "Notebook",
          userAgent: "Firefox",
          createdAt: "2026-07-16T10:00:00.000Z",
          lastUsedAt: "2026-07-16T11:00:00.000Z",
          expiresAt: "2026-08-16T10:00:00.000Z",
          current: true,
          revoked: false,
          revokedAt: null,
          revocationReason: null,
        },
      ],
    });
    vi.spyOn(authSecurityService, "listDevices").mockResolvedValue({
      devices: [
        {
          id: "d1",
          displayName: "Notebook",
          userAgent: "Firefox",
          status: "APPROVED",
          isInitialDevice: true,
          approvedAt: "2026-07-16T09:00:00.000Z",
          firstSeenAt: "2026-07-16T09:00:00.000Z",
          lastSeenAt: "2026-07-16T11:00:00.000Z",
          revokedAt: null,
          current: true,
        },
      ],
    });
    await setup();
    expect(screen.getAllByText(/carregando dados reais/i).length).toBeGreaterThan(0);
    expect(await screen.findAllByText("Notebook")).toHaveLength(2);
    expect(screen.getByText("Sessão atual")).toBeInTheDocument();
    expect(screen.getByText("Dispositivo atual")).toBeInTheDocument();
  });

  it("renders empty and safe error states", async () => {
    vi.spyOn(authSecurityService, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(authSecurityService, "listDevices").mockRejectedValue(new Error("boom"));
    await setup();
    expect(await screen.findByText(/nenhum registro ativo/i)).toBeInTheDocument();
    expect(await screen.findByText(/não foi possível conectar/i)).toBeInTheDocument();
  });

  it("confirms revocation, prevents double submit and invalidates another session", async () => {
    vi.spyOn(authSecurityService, "listSessions").mockResolvedValue({
      sessions: [
        {
          id: "s2",
          deviceId: "d2",
          deviceName: "Celular",
          userAgent: "Chrome",
          createdAt: "2026-07-16T10:00:00.000Z",
          lastUsedAt: "2026-07-16T11:00:00.000Z",
          expiresAt: "2026-08-16T10:00:00.000Z",
          current: false,
          revoked: false,
          revokedAt: null,
          revocationReason: null,
        },
      ],
    });
    vi.spyOn(authSecurityService, "listDevices").mockResolvedValue({ devices: [] });
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
    expect(toast.success).toHaveBeenCalledWith("Sessão revogada.");
    expect(auth.clearAuthentication).not.toHaveBeenCalled();
  });

  it("clears auth for current device and validates password form", async () => {
    vi.spyOn(authSecurityService, "listSessions").mockResolvedValue({ sessions: [] });
    vi.spyOn(authSecurityService, "listDevices").mockResolvedValue({
      devices: [
        {
          id: "d1",
          displayName: "Atual",
          userAgent: null,
          status: "APPROVED",
          isInitialDevice: true,
          approvedAt: null,
          firstSeenAt: "2026-07-16T09:00:00.000Z",
          lastSeenAt: null,
          revokedAt: null,
          current: true,
        },
      ],
    });
    vi.spyOn(authSecurityService, "revokeDevice").mockResolvedValue({ message: "ok" });
    const change = vi
      .spyOn(authSecurityService, "changePassword")
      .mockResolvedValue({ message: "ok" });
    await setup();
    fireEvent.click(await screen.findByRole("button", { name: /revogar dispositivo/i }));
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
    await waitFor(() => expect(auth.clearAuthentication).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: /alterar senha/i }));
    expect(screen.getByText(/informe a senha atual/i)).toBeInTheDocument();
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
    await waitFor(() =>
      expect(change).toHaveBeenCalledWith({
        currentPassword: "current password",
        newPassword: "new password 123",
      }),
    );
    expect(screen.getByLabelText(/senha atual/i)).toHaveValue("");
  });
});
