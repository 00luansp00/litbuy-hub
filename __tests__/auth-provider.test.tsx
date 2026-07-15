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
    await expect(ctx.login("user@example.com", "passwordpassword")).rejects.toThrow(
      "Challenge de 2FA",
    );
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
    await expect(ctx.login("user@example.com", "passwordpassword")).rejects.toMatchObject({
      code: "INVALID_SESSION",
    });
    expect(ctx.user).toBeNull();
    expect(getAccessToken()).toBeNull();
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
