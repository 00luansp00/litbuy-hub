import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AdminGate } from "@/components/admin/AdminGate";
import { SellerGate } from "@/components/seller/SellerGate";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import type { AuthUser, PlatformRole } from "@/services/auth";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const user = (roles: PlatformRole[]): AuthUser => ({
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  emailVerified: true,
  phoneVerified: false,
  birthDate: "2000-01-01T00:00:00.000Z",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  roles,
  displayName: "user",
  name: "user",
  activeRole: "buyer",
});

function value(overrides: Partial<AuthContextValue>): AuthContextValue {
  return {
    user: null,
    isAuthenticated: false,
    initializing: false,
    loading: false,
    status: "anonymous",
    activeRole: "buyer",
    hasSellerProfile: false,
    hasSellerAccess: false,
    isAdmin: false,
    twoFactorChallenge: null,
    login: async () => ({ status: "deviceApprovalRequired" }),
    register: async () => {},
    verifyEmail: async () => {},
    approveDevice: async () => {},
    verifyTwoFactorLogin: async () => user(["buyer"]),
    resendTwoFactorLogin: async () => {},
    resendEmailVerification: async () => {},
    resendDeviceApproval: async () => {},
    refreshSession: async () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
    clearAuthentication: () => {},
    switchToBuyer: () => {},
    switchToSeller: () => ({ ok: false, needsOnboarding: true }),
    toggleRole: () => ({ ok: false, needsOnboarding: true, role: "buyer" }),
    ...overrides,
  };
}

function renderWithAuth(children: React.ReactNode, overrides: Partial<AuthContextValue>) {
  return render(<AuthContext.Provider value={value(overrides)}>{children}</AuthContext.Provider>);
}

describe("AdminGate", () => {
  it("shows loading while initializing", () => {
    renderWithAuth(<AdminGate>admin content</AdminGate>, {
      initializing: true,
      status: "initializing",
    });
    expect(screen.getByText(/carregando sessão segura/i)).toBeInTheDocument();
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });

  it("asks visitors to login", () => {
    renderWithAuth(<AdminGate>admin content</AdminGate>, {});
    expect(screen.getByText(/entre para acessar o painel/i)).toBeInTheDocument();
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });

  it("blocks buyers and demo flags do not grant access", () => {
    vi.stubEnv("VITE_ENABLE_DEMO_ROLES", "true");
    renderWithAuth(<AdminGate>admin content</AdminGate>, {
      user: user(["buyer"]),
      isAuthenticated: true,
      status: "authenticated",
      isAdmin: false,
    });
    expect(screen.getByText(/acesso restrito/i)).toBeInTheDocument();
    expect(screen.queryByText("admin content")).not.toBeInTheDocument();
  });

  it("renders for administrators", () => {
    renderWithAuth(<AdminGate>admin content</AdminGate>, {
      user: user(["buyer", "admin"]),
      isAuthenticated: true,
      status: "authenticated",
      isAdmin: true,
    });
    expect(screen.getByText("admin content")).toBeInTheDocument();
  });
});

describe("SellerGate", () => {
  it("shows loading while initializing", () => {
    renderWithAuth(<SellerGate>seller content</SellerGate>, {
      initializing: true,
      status: "initializing",
    });
    expect(screen.getByText(/carregando sessão segura/i)).toBeInTheDocument();
    expect(screen.queryByText("seller content")).not.toBeInTheDocument();
  });

  it("asks visitors to login", () => {
    renderWithAuth(<SellerGate>seller content</SellerGate>, {});
    expect(screen.getByText(/entre para acessar o painel vendedor/i)).toBeInTheDocument();
    expect(screen.queryByText("seller content")).not.toBeInTheDocument();
  });

  it("blocks buyers and demo flags do not grant access", () => {
    vi.stubEnv("VITE_ENABLE_DEMO_ROLES", "true");
    renderWithAuth(<SellerGate>seller content</SellerGate>, {
      user: user(["buyer"]),
      isAuthenticated: true,
      status: "authenticated",
      hasSellerAccess: false,
    });
    expect(screen.getByText(/acesso de vendedor pendente/i)).toBeInTheDocument();
    expect(screen.queryByText("seller content")).not.toBeInTheDocument();
  });

  it("renders for sellers", () => {
    renderWithAuth(<SellerGate>seller content</SellerGate>, {
      user: user(["buyer", "seller"]),
      isAuthenticated: true,
      status: "authenticated",
      hasSellerAccess: true,
    });
    expect(screen.getByText("seller content")).toBeInTheDocument();
  });
});
