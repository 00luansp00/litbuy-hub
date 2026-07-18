import type React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthGate } from "@/components/auth/AuthGate";

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import type { AuthUser } from "@/services/auth";

const authUser: AuthUser = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  emailVerified: true,
  phoneVerified: false,
  birthDate: "2000-01-01T00:00:00.000Z",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  roles: ["buyer"],
  displayName: "user",
  name: "user",
};

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
    verifyTwoFactorLogin: async () => authUser,
    resendTwoFactorLogin: async () => {},
    resendEmailVerification: async () => {},
    resendDeviceApproval: async () => {},
    refreshSession: async () => {},
    requestPasswordReset: async () => {},
    resetPassword: async () => {},
    logout: async () => {},
    clearAuthentication: () => {},
    switchToBuyer: () => {},
    switchToSeller: () => ({ ok: true, needsOnboarding: false }),
    toggleRole: () => ({ ok: true, needsOnboarding: false, role: "buyer" }),
    ...overrides,
  };
}

describe("AuthGate", () => {
  it("shows neutral state while initializing and never flashes private content", () => {
    render(
      <AuthContext.Provider value={value({ initializing: true, status: "initializing" })}>
        <AuthGate>
          <div>privado</div>
        </AuthGate>
      </AuthContext.Provider>,
    );
    expect(screen.getByText(/carregando sessão segura/i)).toBeInTheDocument();
    expect(screen.queryByText("privado")).not.toBeInTheDocument();
  });

  it("blocks anonymous users and renders authenticated content", () => {
    const { rerender } = render(
      <AuthContext.Provider value={value({})}>
        <AuthGate>
          <div>privado</div>
        </AuthGate>
      </AuthContext.Provider>,
    );
    expect(screen.queryByText("privado")).not.toBeInTheDocument();
    rerender(
      <AuthContext.Provider value={value({ isAuthenticated: true, status: "authenticated" })}>
        <AuthGate>
          <div>privado</div>
        </AuthGate>
      </AuthContext.Provider>,
    );
    expect(screen.getByText("privado")).toBeInTheDocument();
  });
});
