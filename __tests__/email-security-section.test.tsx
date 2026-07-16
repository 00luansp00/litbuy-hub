import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { phoneEmailSecurityService } from "@/services/auth/phoneEmailSecurity";
import { EmailSecuritySection } from "@/components/account/security/EmailSecuritySection";

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

function auth(): AuthContextValue {
  return {
    user: {
      id: "u",
      email: "user@example.com",
      emailVerified: true,
      phoneVerified: false,
      birthDate: "2000-01-01",
      status: "ACTIVE",
      createdAt: "2026-01-01",
      displayName: "user",
      name: "user",
    },
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

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

function setup() {
  cleanup();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const authValue = auth();
  render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>
        <EmailSecuritySection currentEmail={authValue.user?.email} />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
  return { queryClient, authValue };
}

function fill(email = "new@example.com", password = "current secret") {
  fireEvent.change(screen.getByLabelText(/^novo e-mail$/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/confirmar novo e-mail/i), { target: { value: email } });
  fireEvent.change(screen.getByLabelText(/senha da conta/i), { target: { value: password } });
}

beforeEach(() => {
  vi.restoreAllMocks();
  toast.error.mockReset();
  toast.success.mockReset();
  localStorage.clear();
  sessionStorage.clear();
  window.history.replaceState(null, "", "/perfil/seguranca");
});

describe("EmailSecuritySection", () => {
  it("validates invalid, divergent, unchanged email and required password", () => {
    setup();
    fireEvent.change(screen.getByLabelText(/^novo e-mail$/i), { target: { value: "bad" } });
    fireEvent.click(screen.getByRole("button", { name: /solicitar alteração/i }));
    expect(screen.getByText("Informe um e-mail válido.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^novo e-mail$/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar novo e-mail/i), {
      target: { value: "other@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /solicitar alteração/i }));
    expect(screen.getByText("A confirmação do e-mail não confere.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^novo e-mail$/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar novo e-mail/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /solicitar alteração/i }));
    expect(screen.getByText("Informe um e-mail diferente do atual.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/^novo e-mail$/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/confirmar novo e-mail/i), {
      target: { value: "new@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /solicitar alteração/i }));
    expect(screen.getByText("Informe a senha atual.")).toBeInTheDocument();
  });

  it("submits exact payload once, shows loading, clears fields, keeps user email and URL safe", async () => {
    const { queryClient, authValue } = setup();
    const pending = deferred<{ requestId: string; expiresAt: string; message: string }>();
    const request = vi
      .spyOn(phoneEmailSecurityService, "requestEmailChange")
      .mockReturnValue(pending.promise);
    fill();
    const button = screen.getByRole("button", { name: /solicitar alteração/i });
    fireEvent.click(button);
    fireEvent.click(button);
    expect(await screen.findByRole("button", { name: /enviando confirmações/i })).toBeDisabled();
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith({
      newEmail: "new@example.com",
      currentPassword: "current secret",
    });
    pending.resolve({ requestId: "req", expiresAt: "2026-07-16T12:00:00.000Z", message: "sent" });
    expect(await screen.findByText(/dupla confirmação/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^novo e-mail$/i)).toHaveValue("");
    expect(authValue.user?.email).toBe("user@example.com");
    expect(location.href).not.toContain("new@example.com");
    const cache = JSON.stringify(queryClient.getMutationCache().getAll());
    expect(cache).not.toContain("new@example.com");
    expect(JSON.stringify(localStorage)).not.toContain("current secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("new@example.com");
  });

  it("preserves fields on error and keeps secrets out of mutation cache", async () => {
    const { queryClient } = setup();
    vi.spyOn(phoneEmailSecurityService, "requestEmailChange").mockRejectedValue(
      new ApiError(503, "EMAIL_DELIVERY_UNAVAILABLE", "down"),
    );
    fill();
    fireEvent.click(screen.getByRole("button", { name: /solicitar alteração/i }));
    expect(
      await screen.findByText("Entrega de e-mail indisponível no momento."),
    ).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("new@example.com").length).toBeGreaterThan(0);
    const cache = JSON.stringify(queryClient.getMutationCache().getAll());
    expect(cache).not.toContain("new@example.com");
    expect(cache).not.toContain("current secret");
  });
});
