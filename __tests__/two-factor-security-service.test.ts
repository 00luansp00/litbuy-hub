import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import {
  parseTwoFactorEnrollConfirmResponse,
  parseTwoFactorStatus,
  twoFactorSecurityService,
} from "@/services/auth/twoFactorSecurity";

const fetchMock = vi.fn();
Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });

const challenge = {
  challengeId: "123e4567-e89b-42d3-a456-426614174000",
  expiresAt: "2026-07-16T12:00:00.000Z",
  message: "sent",
};
const recoveryCodes = Array.from({ length: 10 }, (_, index) => `ABCD-EF${index}1-GH${index}2`);

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
  it("validates status runtime contract", () => {
    expect(
      parseTwoFactorStatus({
        enabled: false,
        method: null,
        enabledAt: null,
        recoveryCodesRemaining: 0,
      }),
    ).toEqual({ enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 0 });
    expect(
      parseTwoFactorStatus({
        enabled: true,
        method: "EMAIL",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 8,
      }),
    ).toMatchObject({ method: "EMAIL" });
    for (const body of [
      {
        enabled: true,
        method: null,
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 1,
      },
      { enabled: true, method: "SMS", enabledAt: null, recoveryCodesRemaining: 1 },
      { enabled: false, method: "EMAIL", enabledAt: null, recoveryCodesRemaining: 0 },
      {
        enabled: false,
        method: null,
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 0,
      },
      { enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 1 },
      { enabled: true, method: "EMAIL", enabledAt: "bad", recoveryCodesRemaining: 1 },
      {
        enabled: true,
        method: "EMAIL",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: -1,
      },
      {
        enabled: true,
        method: "EMAIL",
        enabledAt: "2026-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 1.2,
      },
    ])
      expect(() => parseTwoFactorStatus(body)).toThrow(ApiError);
  });

  it("sends Authorization, CSRF and exact payloads", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok(challenge))
      .mockResolvedValueOnce(await ok({ recoveryCodes }))
      .mockResolvedValueOnce(await ok(challenge))
      .mockResolvedValueOnce(await ok({ message: "done" }))
      .mockResolvedValueOnce(await ok({ message: "done" }));
    await twoFactorSecurityService.requestEnrollment({
      method: "EMAIL",
      currentPassword: "secret",
    });
    await twoFactorSecurityService.confirmEnrollment({
      challengeId: challenge.challengeId,
      code: "123456",
    });
    await twoFactorSecurityService.requestDisable({ currentPassword: "secret" });
    await twoFactorSecurityService.confirmDisable({
      challengeId: challenge.challengeId,
      code: "654321",
    });
    await twoFactorSecurityService.confirmDisable({
      challengeId: challenge.challengeId,
      recoveryCode: "ABCD-EF01-GH02",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/2fa/enroll/request");
    expect(fetchMock.mock.calls[0][1].headers.get("Authorization")).toBe("Bearer access-token");
    expect(fetchMock.mock.calls[0][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      method: "EMAIL",
      currentPassword: "secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: challenge.challengeId,
      code: "123456",
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({ currentPassword: "secret" });
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({
      challengeId: challenge.challengeId,
      code: "654321",
    });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({
      challengeId: challenge.challengeId,
      recoveryCode: "ABCD-EF01-GH02",
    });
    expect(JSON.stringify(localStorage)).not.toContain("secret");
    expect(JSON.stringify(sessionStorage)).not.toContain("123456");
  });

  it("refreshes after 401 and clears token when refresh finally fails", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "fresh" }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        await ok({ enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 0 }),
      );
    await twoFactorSecurityService.getStatus();
    expect(getAccessToken()).toBe("fresh");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      );
    await expect(twoFactorSecurityService.getStatus()).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it("rejects malformed challenge, empty body, HTML, malformed JSON and recovery code lists", async () => {
    fetchMock.mockResolvedValueOnce(
      await ok({ challengeId: "bad", expiresAt: "2026-07-16T12:00:00.000Z" }),
    );
    await expect(
      twoFactorSecurityService.requestEnrollment({ method: "SMS", currentPassword: "secret" }),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 200 }));
    await expect(twoFactorSecurityService.getStatus()).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
    fetchMock.mockResolvedValueOnce(new Response("<html></html>", { status: 200 }));
    await expect(twoFactorSecurityService.getStatus()).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
    fetchMock.mockResolvedValueOnce(new Response("{", { status: 200 }));
    await expect(twoFactorSecurityService.getStatus()).rejects.toMatchObject({
      code: "MALFORMED_RESPONSE",
    });
    expect(parseTwoFactorEnrollConfirmResponse({ recoveryCodes })).toEqual({ recoveryCodes });
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({ recoveryCodes: recoveryCodes.slice(0, 9) }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...recoveryCodes.slice(0, 9), recoveryCodes[0]],
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({ recoveryCodes: [...recoveryCodes.slice(0, 9), "bad"] }),
    ).toThrow(ApiError);
  });
});
