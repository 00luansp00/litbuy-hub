import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, act, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { setAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { phoneEmailSecurityService } from "@/services/auth/phoneEmailSecurity";
import { useEmailSecurity, usePhoneSecurity } from "@/services/auth/usePhoneEmailSecurity";

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

function wrapper(queryClient: QueryClient, authValue: AuthContextValue) {
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={authValue}>{children}</AuthContext.Provider>
    </QueryClientProvider>
  );
}

function cacheText(queryClient: QueryClient) {
  return JSON.stringify(queryClient.getMutationCache().getAll());
}

beforeEach(() => {
  vi.restoreAllMocks();
  navigate.mockReset();
  toast.error.mockReset();
  toast.info.mockReset();
  setAccessToken("access-token");
});

describe("phone/email security hooks", () => {
  it("does not store phone variables in MutationCache after success or error", async () => {
    const queryClient = new QueryClient();
    const authValue = auth();
    vi.spyOn(phoneEmailSecurityService, "requestPhoneVerification")
      .mockResolvedValueOnce({
        challengeId: "11111111-1111-4111-8111-111111111111",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => usePhoneSecurity(), {
      wrapper: wrapper(queryClient, authValue),
    });
    await act(async () => {
      await result.current.requestPhone({
        phone: "(17) 99999-1234",
        currentPassword: "secret pass",
      });
    });
    await expect(
      act(async () => {
        await result.current.requestPhone({
          phone: "(17) 98888-1234",
          currentPassword: "secret fail",
        });
      }),
    ).rejects.toThrow("boom");
    const cache = cacheText(queryClient);
    expect(cache).not.toContain("99999");
    expect(cache).not.toContain("secret pass");
    expect(cache).not.toContain("11111111");
  });

  it("does not store email variables in MutationCache after success or error", async () => {
    const queryClient = new QueryClient();
    const authValue = auth();
    vi.spyOn(phoneEmailSecurityService, "requestEmailChange")
      .mockResolvedValueOnce({
        requestId: "req",
        expiresAt: "2026-07-16T12:00:00.000Z",
        message: "sent",
      })
      .mockRejectedValueOnce(new Error("boom"));
    const { result } = renderHook(() => useEmailSecurity(), {
      wrapper: wrapper(queryClient, authValue),
    });
    await act(async () => {
      await result.current.requestEmailChange({
        newEmail: "new@example.com",
        currentPassword: "secret pass",
      });
    });
    await expect(
      act(async () => {
        await result.current.requestEmailChange({
          newEmail: "fail@example.com",
          currentPassword: "secret fail",
        });
      }),
    ).rejects.toThrow("boom");
    const cache = cacheText(queryClient);
    expect(cache).not.toContain("new@example.com");
    expect(cache).not.toContain("secret pass");
  });

  it("awaits private query cancellation/removal before logout can be repopulated", async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const authValue = auth();
    let resolvePrivate!: (value: { leaked: boolean }) => void;
    const privatePromise = new Promise<{ leaked: boolean }>((resolve) => {
      resolvePrivate = resolve;
    });
    void queryClient
      .fetchQuery({ queryKey: ["auth", "private"], queryFn: () => privatePromise })
      .catch(() => undefined);
    vi.spyOn(phoneEmailSecurityService, "confirmEmailChange").mockResolvedValue({
      status: "COMPLETED",
      message: "done",
    });
    const { result } = renderHook(() => useEmailSecurity(), {
      wrapper: wrapper(queryClient, authValue),
    });
    await act(async () => {
      await result.current.confirmEmailChange({
        token: "email-token.secret",
        newEmail: "new@example.com",
      });
    });
    expect(authValue.clearAuthentication).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith({ to: "/login" });
    resolvePrivate({ leaked: true });
    await waitFor(() => expect(queryClient.getQueryData(["auth", "private"])).toBeUndefined());
    const cache = cacheText(queryClient);
    expect(cache).not.toContain("email-token.secret");
    expect(cache).not.toContain("new@example.com");
  });
});
