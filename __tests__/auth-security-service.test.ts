import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import { authSecurityService } from "@/services/auth/security";

const fetchMock = vi.fn();
Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });

function ok(body?: unknown) {
  return Promise.resolve(
    new Response(body === undefined ? null : JSON.stringify(body), { status: 200 }),
  );
}

beforeEach(() => {
  fetchMock.mockReset();
  setAccessToken("access-token");
  Object.defineProperty(document, "cookie", { writable: true, value: "litbuy_csrf=csrf-token" });
  localStorage.clear();
  sessionStorage.clear();
});

describe("authSecurityService", () => {
  it("lists sessions and devices with Authorization", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok({ sessions: [] }))
      .mockResolvedValueOnce(await ok({ devices: [] }));
    await authSecurityService.listSessions();
    await authSecurityService.listDevices();
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer access-token");
    expect(fetchMock.mock.calls[1][1].credentials).toBe("include");
  });

  it("sends CSRF on revocations and password change without persisting secrets", async () => {
    fetchMock.mockImplementation(() => ok({ message: "ok" }));
    await authSecurityService.revokeSession("11111111-1111-4111-8111-111111111111");
    await authSecurityService.revokeDevice("22222222-2222-4222-8222-222222222222");
    await authSecurityService.logoutAllSessions();
    await authSecurityService.changePassword({
      currentPassword: "current secret",
      newPassword: "new secret 123",
    });
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(fetchMock.mock.calls[1][1].method).toBe("DELETE");
    expect(fetchMock.mock.calls[2][1].method).toBe("POST");
    expect(fetchMock.mock.calls[2][0]).toContain("/auth/sessions/logout-all");
    expect(fetchMock.mock.calls[2][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      currentPassword: "current secret",
      newPassword: "new secret 123",
    });
    expect(JSON.stringify(localStorage)).not.toContain("secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("secret");
  });

  it("handles responses without body and ApiError", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(authSecurityService.logoutAllSessions()).resolves.toBeUndefined();
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "RATE_LIMITED", message: "rate" }), { status: 429 }),
    );
    await expect(authSecurityService.listSessions()).rejects.toMatchObject({
      status: 429,
      code: "RATE_LIMITED",
    });
  });

  it("refreshes once on 401 and clears token when refresh fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "fresh" }), { status: 200 }),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ sessions: [] }), { status: 200 }));
    await authSecurityService.listSessions();
    expect(getAccessToken()).toBe("fresh");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      );
    await expect(authSecurityService.listDevices()).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });
});

describe("phoneEmailSecurityService", () => {
  it("requests and verifies phone with exact payload, Authorization and CSRF without storage", async () => {
    const { phoneEmailSecurityService } = await import("@/services/auth/phoneEmailSecurity");
    fetchMock
      .mockResolvedValueOnce(
        await ok({
          challengeId: "11111111-1111-4111-8111-111111111111",
          expiresAt: "2026-07-16T12:00:00.000Z",
          message: "sent",
        }),
      )
      .mockResolvedValueOnce(await ok({ message: "done" }));
    await phoneEmailSecurityService.requestPhoneVerification({
      phone: "(17) 99999-1234",
      currentPassword: "current secret",
    });
    await phoneEmailSecurityService.verifyPhone({
      challengeId: "11111111-1111-4111-8111-111111111111",
      code: "123456",
      phone: "(17) 99999-1234",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/phone/request");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer access-token");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      phone: "(17) 99999-1234",
      currentPassword: "current secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: "11111111-1111-4111-8111-111111111111",
      code: "123456",
      phone: "(17) 99999-1234",
    });
    expect(JSON.stringify(localStorage)).not.toContain("99999");
    expect(JSON.stringify(sessionStorage)).not.toContain("123456");
  });

  it("requests and confirms email change with PENDING and COMPLETED without persisting token", async () => {
    const { phoneEmailSecurityService } = await import("@/services/auth/phoneEmailSecurity");
    fetchMock
      .mockResolvedValueOnce(
        await ok({ requestId: "req", expiresAt: "2026-07-16T12:00:00.000Z", message: "sent" }),
      )
      .mockResolvedValueOnce(await ok({ status: "PENDING", message: "pending" }))
      .mockResolvedValueOnce(await ok({ status: "COMPLETED", message: "done" }));
    await phoneEmailSecurityService.requestEmailChange({
      newEmail: "new@example.com",
      currentPassword: "current secret",
    });
    await expect(
      phoneEmailSecurityService.confirmEmailChange({
        token: "token.secret.value",
        newEmail: "new@example.com",
      }),
    ).resolves.toMatchObject({ status: "PENDING" });
    await expect(
      phoneEmailSecurityService.confirmEmailChange({
        token: "token.secret.value2",
        newEmail: "new@example.com",
      }),
    ).resolves.toMatchObject({ status: "COMPLETED" });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/email/change/request");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer access-token");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      newEmail: "new@example.com",
      currentPassword: "current secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      token: "token.secret.value",
      newEmail: "new@example.com",
    });
    expect(JSON.stringify(localStorage)).not.toContain("token.secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("new@example.com");
  });

  it("propagates ApiError for token and delivery failures", async () => {
    const { phoneEmailSecurityService } = await import("@/services/auth/phoneEmailSecurity");
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "INVALID_OR_EXPIRED_TOKEN", message: "bad" }), {
        status: 400,
      }),
    );
    await expect(
      phoneEmailSecurityService.confirmEmailChange({
        token: "bad.token.value",
        newEmail: "new@example.com",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_TOKEN" });
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "SMS_DELIVERY_UNAVAILABLE", message: "down" }), {
        status: 503,
      }),
    );
    await expect(
      phoneEmailSecurityService.requestPhoneVerification({
        phone: "(17) 99999-1234",
        currentPassword: "current secret",
      }),
    ).rejects.toMatchObject({ status: 503, code: "SMS_DELIVERY_UNAVAILABLE" });
  });
});
