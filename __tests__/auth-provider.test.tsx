import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import { AuthProvider } from "@/providers/AuthProvider";
import { authService } from "@/services/auth";

const me = {
  id: "11111111-1111-4111-8111-111111111111",
  email: "user@example.com",
  emailVerified: true,
  phoneVerified: false,
  birthDate: "2000-01-01T00:00:00.000Z",
  status: "ACTIVE",
  createdAt: "2026-01-01T00:00:00.000Z",
  roles: ["buyer"],
};

let ctx: AuthContextValue;
function Probe() {
  return (
    <AuthContext.Consumer>
      {(value) => {
        if (value) ctx = value;
        return <div data-testid="status">{value?.status}</div>;
      }}
    </AuthContext.Consumer>
  );
}
function setup() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Probe />
      </AuthProvider>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
});

describe("AuthProvider", () => {
  it("bootstraps anonymous without cookies", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    setup();
    await screen.findByText("anonymous");
    expect(ctx.user).toBeNull();
  });

  it("bootstraps authenticated with refresh and /me", async () => {
    vi.spyOn(authService, "refresh").mockResolvedValue({ accessToken: "token" });
    vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("authenticated");
    expect(ctx.user?.email).toBe("user@example.com");
    expect(getAccessToken()).toBe("token");
  });

  it("login HTTP 200 authenticates only after /me", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({ accessToken: "ok", user: me });
    const meSpy = vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await ctx.login("user@example.com", "passwordpassword");
    });
    expect(meSpy).toHaveBeenCalledTimes(1);
    expect(ctx.status).toBe("authenticated");
    expect(ctx.user?.email).toBe("user@example.com");
  });

  it("DEVICE_APPROVAL_REQUIRED does not authenticate or call /me", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({ code: "DEVICE_APPROVAL_REQUIRED" });
    const meSpy = vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("anonymous");
    let result: unknown;
    await act(async () => {
      result = await ctx.login("user@example.com", "passwordpassword");
    });
    expect(result).toEqual({ status: "deviceApprovalRequired" });
    expect(ctx.status).toBe("deviceApprovalRequired");
    expect(ctx.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(meSpy).not.toHaveBeenCalled();
  });

  it("TWO_FACTOR_REQUIRED stores challenge in memory only and does not call /me", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({
      code: "TWO_FACTOR_REQUIRED",
      challengeId: "22222222-2222-4222-8222-222222222222",
      method: "EMAIL",
      expiresAt: "2026-07-15T23:59:00.000Z",
    });
    const meSpy = vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await ctx.login("user@example.com", "passwordpassword");
    });
    expect(ctx.status).toBe("twoFactorRequired");
    expect(ctx.twoFactorChallenge?.challengeId).toBe("22222222-2222-4222-8222-222222222222");
    expect(ctx.user).toBeNull();
    expect(getAccessToken()).toBeNull();
    expect(meSpy).not.toHaveBeenCalled();
  });

  it("rejects malformed 202 challenge without fallback method or /me", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({
      code: "TWO_FACTOR_REQUIRED",
      challengeId: "",
      method: "PUSH" as "EMAIL",
      expiresAt: "bad",
    });
    const meSpy = vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await expect(ctx.login("user@example.com", "passwordpassword")).rejects.toThrow(
        "Challenge de 2FA",
      );
    });
    expect(ctx.user).toBeNull();
    expect(meSpy).not.toHaveBeenCalled();
  });

  it("EMAIL_NOT_VERIFIED returns explicit state instead of invalid credentials", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockRejectedValue(
      new ApiError(403, "EMAIL_NOT_VERIFIED", "verify"),
    );
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await expect(ctx.login("user@example.com", "passwordpassword")).resolves.toEqual({
        status: "emailVerificationRequired",
      });
    });
    expect(ctx.status).toBe("emailVerificationRequired");
  });

  it("clears token and user if /me fails after login", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({ accessToken: "partial", user: me });
    vi.spyOn(authService, "me").mockRejectedValue(new ApiError(401, "INVALID_SESSION", "invalid"));
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await expect(ctx.login("user@example.com", "passwordpassword")).rejects.toMatchObject({
        code: "INVALID_SESSION",
      });
    });
    expect(ctx.user).toBeNull();
    expect(getAccessToken()).toBeNull();
  });

  it("refreshSession calls refresh once and /me once", async () => {
    vi.spyOn(authService, "refresh")
      .mockRejectedValueOnce(new ApiError(401, "INVALID_SESSION", "invalid"))
      .mockResolvedValueOnce({ accessToken: "fresh" });
    const meSpy = vi.spyOn(authService, "me").mockResolvedValue(me);
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await ctx.refreshSession();
    });
    expect(authService.refresh).toHaveBeenCalledTimes(2);
    expect(meSpy).toHaveBeenCalledTimes(1);
    expect(ctx.status).toBe("authenticated");
    expect(getAccessToken()).toBe("fresh");
  });

  it("exposes loading for password reset, resend actions, and concurrent operations", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    let resolveForgot!: () => void;
    let resolveEmail!: () => void;
    vi.spyOn(authService, "forgotPassword").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveForgot = resolve;
        }),
    );
    vi.spyOn(authService, "resendEmailVerification").mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveEmail = resolve;
        }),
    );
    setup();
    await screen.findByText("anonymous");
    let forgot!: Promise<void>;
    await act(async () => {
      forgot = ctx.requestPasswordReset("user@example.com");
    });
    expect(ctx.loading).toBe(true);
    let email!: Promise<void>;
    await act(async () => {
      email = ctx.resendEmailVerification("user@example.com");
    });
    expect(ctx.loading).toBe(true);
    await act(async () => {
      resolveForgot();
      await forgot;
    });
    expect(ctx.loading).toBe(true);
    await act(async () => {
      resolveEmail();
      await email;
    });
    expect(ctx.loading).toBe(false);
  });

  it("keeps loading around reset errors and single-flights 2FA resend", async () => {
    vi.spyOn(authService, "refresh").mockRejectedValue(
      new ApiError(401, "INVALID_SESSION", "invalid"),
    );
    vi.spyOn(authService, "login").mockResolvedValue({
      code: "TWO_FACTOR_REQUIRED",
      challengeId: "22222222-2222-4222-8222-222222222222",
      method: "EMAIL",
      expiresAt: "2026-07-16T00:10:00.000Z",
    });
    let rejectReset!: (error: Error) => void;
    vi.spyOn(authService, "resetPassword").mockImplementation(
      () =>
        new Promise<void>((_, reject) => {
          rejectReset = reject;
        }),
    );
    let resolveResend!: (value: { challengeId: string; expiresAt: string }) => void;
    const resendSpy = vi.spyOn(authService, "resendTwoFactorLogin").mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveResend = resolve;
        }),
    );
    setup();
    await screen.findByText("anonymous");
    await act(async () => {
      await ctx.login("user@example.com", "passwordpassword");
    });
    let reset!: Promise<void>;
    await act(async () => {
      reset = ctx.resetPassword("token", "passwordpassword");
    });
    expect(ctx.loading).toBe(true);
    await act(async () => {
      rejectReset(new Error("bad token"));
      await expect(reset).rejects.toThrow("bad token");
    });
    expect(ctx.loading).toBe(false);

    let first!: Promise<void>;
    let second!: Promise<void>;
    await act(async () => {
      first = ctx.resendTwoFactorLogin();
      second = ctx.resendTwoFactorLogin();
    });
    expect(ctx.loading).toBe(true);
    await act(async () => {
      resolveResend({
        challengeId: "33333333-3333-4333-8333-333333333333",
        expiresAt: "2026-07-16T00:20:00.000Z",
      });
      await Promise.all([first, second]);
    });
    expect(resendSpy).toHaveBeenCalledTimes(1);
    expect(ctx.twoFactorChallenge?.challengeId).toBe("33333333-3333-4333-8333-333333333333");
    expect(ctx.loading).toBe(false);
  });

  it("logout clears local state even when API fails and does not persist tokens", async () => {
    vi.spyOn(authService, "refresh").mockResolvedValue({ accessToken: "token" });
    vi.spyOn(authService, "me").mockResolvedValue(me);
    vi.spyOn(authService, "logout").mockRejectedValue(new Error("down"));
    const localSpy = vi.spyOn(Storage.prototype, "setItem");
    setup();
    await screen.findByText("authenticated");
    await act(async () => {
      await ctx.logout();
    });
    await waitFor(() => expect(ctx.status).toBe("anonymous"));
    expect(ctx.user).toBeNull();
    expect(localSpy).not.toHaveBeenCalledWith(expect.stringMatching(/token/i), expect.anything());
  });
});

it("derives RBAC only from backend roles and blocks seller switch without SELLER", async () => {
  vi.stubEnv("VITE_ENABLE_DEMO_ROLES", "true");
  vi.spyOn(authService, "refresh").mockResolvedValue({ accessToken: "token" });
  vi.spyOn(authService, "me").mockResolvedValue(me);
  setup();
  await screen.findByText("authenticated");
  expect(ctx.isAdmin).toBe(false);
  expect(ctx.hasSellerAccess).toBe(false);
  expect(ctx.hasSellerProfile).toBe(false);
  expect(ctx.switchToSeller()).toEqual({ ok: false, needsOnboarding: true });
  expect(ctx.activeRole).toBe("buyer");
});

it("allows seller presentation mode only with SELLER role", async () => {
  vi.spyOn(authService, "refresh").mockResolvedValue({ accessToken: "token" });
  vi.spyOn(authService, "me").mockResolvedValue({ ...me, roles: ["buyer", "seller"] });
  setup();
  await screen.findByText("authenticated");
  expect(ctx.hasSellerAccess).toBe(true);
  await act(async () => {
    expect(ctx.switchToSeller()).toEqual({ ok: true, needsOnboarding: false });
  });
  expect(ctx.activeRole).toBe("seller");
});

it("derives admin only from ADMIN role", async () => {
  vi.spyOn(authService, "refresh").mockResolvedValue({ accessToken: "token" });
  vi.spyOn(authService, "me").mockResolvedValue({ ...me, roles: ["buyer", "admin"] });
  setup();
  await screen.findByText("authenticated");
  expect(ctx.isAdmin).toBe(true);
});
