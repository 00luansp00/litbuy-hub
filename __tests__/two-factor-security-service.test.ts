import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, setAccessToken } from "@/lib/api/client";
import {
  parseTwoFactorEnrollConfirmResponse,
  parseTwoFactorStatus,
  twoFactorSecurityService,
} from "@/services/auth/twoFactorSecurity";

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

describe("twoFactorSecurityService", () => {
  it("gets status with Authorization and parses enabled/disabled states", async () => {
    fetchMock
      .mockResolvedValueOnce(
        await ok({ enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 0 }),
      )
      .mockResolvedValueOnce(
        await ok({
          enabled: true,
          method: "EMAIL",
          enabledAt: "2026-07-16T12:00:00.000Z",
          recoveryCodesRemaining: 10,
        }),
      )
      .mockResolvedValueOnce(
        await ok({
          enabled: true,
          method: "SMS",
          enabledAt: "2026-07-16T12:00:00.000Z",
          recoveryCodesRemaining: 2,
        }),
      );
    await expect(twoFactorSecurityService.getTwoFactorStatus()).resolves.toMatchObject({
      enabled: false,
    });
    await expect(twoFactorSecurityService.getTwoFactorStatus()).resolves.toMatchObject({
      method: "EMAIL",
    });
    await expect(twoFactorSecurityService.getTwoFactorStatus()).resolves.toMatchObject({
      method: "SMS",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/2fa/status");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer access-token");
  });

  it("rejects malformed status combinations", () => {
    expect(() =>
      parseTwoFactorStatus({
        enabled: true,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorStatus({
        enabled: false,
        method: "EMAIL",
        enabledAt: null,
        recoveryCodesRemaining: 0,
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorStatus({
        enabled: true,
        method: "EMAIL",
        enabledAt: "bad",
        recoveryCodesRemaining: 0,
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorStatus({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: -1,
      }),
    ).toThrow(ApiError);
  });

  it("requests and confirms enrollment with exact payload and no storage", async () => {
    fetchMock
      .mockResolvedValueOnce(
        await ok({
          challengeId: "11111111-1111-4111-8111-111111111111",
          expiresAt: "2026-07-16T12:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(
        await ok({ recoveryCodes: Array.from({ length: 10 }, (_, i) => `AAAAA-AAAAA-AAAA${i}`) }),
      );
    await twoFactorSecurityService.requestTwoFactorEnrollment({
      method: "EMAIL",
      currentPassword: "secret pass",
    });
    await twoFactorSecurityService.confirmTwoFactorEnrollment({
      challengeId: "11111111-1111-4111-8111-111111111111",
      code: "123456",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/2fa/enroll/request");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      method: "EMAIL",
      currentPassword: "secret pass",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: "11111111-1111-4111-8111-111111111111",
      code: "123456",
    });
    expect(JSON.stringify(localStorage)).not.toContain("secret pass");
    expect(JSON.stringify(sessionStorage)).not.toContain("123456");
  });

  it("rejects malformed enrollment challenges and recovery codes", () => {
    expect(() => parseTwoFactorEnrollConfirmResponse({ recoveryCodes: [] })).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({ recoveryCodes: Array(10).fill("AAAAA-AAAAA-AAAAA") }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...Array.from({ length: 9 }, (_, i) => `AAAAA-AAAAA-AAAA${i}`), "bad"],
      }),
    ).toThrow(ApiError);
  });

  it("requests disable and confirms by code or recovery code", async () => {
    fetchMock
      .mockResolvedValueOnce(
        await ok({
          challengeId: "22222222-2222-4222-8222-222222222222",
          expiresAt: "2026-07-16T12:00:00.000Z",
        }),
      )
      .mockResolvedValueOnce(await ok({ message: "done" }))
      .mockResolvedValueOnce(await ok({ message: "done" }));
    await twoFactorSecurityService.requestTwoFactorDisable({ currentPassword: "secret pass" });
    await twoFactorSecurityService.confirmTwoFactorDisable({
      challengeId: "22222222-2222-4222-8222-222222222222",
      code: "123456",
    });
    await twoFactorSecurityService.confirmTwoFactorDisable({
      challengeId: "22222222-2222-4222-8222-222222222222",
      recoveryCode: "AAAAA-BBBBB-CCCCC",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/2fa/disable/request");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: "22222222-2222-4222-8222-222222222222",
      code: "123456",
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      challengeId: "22222222-2222-4222-8222-222222222222",
      recoveryCode: "AAAAA-BBBBB-CCCCC",
    });
  });

  it("refreshes once on 401 and propagates delivery errors", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(await ok({ accessToken: "fresh" }))
      .mockResolvedValueOnce(
        await ok({ enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 0 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "TWO_FACTOR_DELIVERY_UNAVAILABLE" }), { status: 503 }),
      );
    await expect(twoFactorSecurityService.getTwoFactorStatus()).resolves.toMatchObject({
      enabled: false,
    });
    await expect(
      twoFactorSecurityService.requestTwoFactorEnrollment({
        method: "SMS",
        currentPassword: "secret",
      }),
    ).rejects.toMatchObject({ code: "TWO_FACTOR_DELIVERY_UNAVAILABLE" });
  });
});
