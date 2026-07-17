import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import {
  normalizeRecoveryCode,
  isMethodChangeOutcomeUnknown,
  parseMethodChangeChallenge,
  parseMethodChangeConfirmResponse,
  parseStepUpChallenge,
  parseStepUpGrant,
  parseTwoFactorChallenge,
  parseTwoFactorDisableConfirmResponse,
  parseTwoFactorEnrollConfirmResponse,
  parseTwoFactorStatus,
  twoFactorSecurityService,
} from "@/services/auth/twoFactorSecurity";

const fetchMock = vi.fn();
Object.defineProperty(globalThis, "fetch", { value: fetchMock, writable: true });

const challenge = {
  challengeId: "550e8400-e29b-41d4-a716-446655440000",
  expiresAt: "2099-07-16T12:00:00.000Z",
  message: "sent",
};
const recoveryCodes = [
  "ABCDE-12345-FGHIJ",
  "BCDEF-23456-GHIJK",
  "CDEFG-34567-HIJKL",
  "DEFGH-45678-IJKLM",
  "EFGHI-56789-JKLMN",
  "FGHIJ-67890-KLMNO",
  "GHIJK-78901-LMNOP",
  "HIJKL-89012-MNOPQ",
  "IJKLM-90123-NOPQR",
  "JKLMN-01234-OPQRS",
];

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
        enabledAt: "2099-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 8,
      }),
    ).toMatchObject({ method: "EMAIL" });
    for (const body of [
      {
        enabled: true,
        method: null,
        enabledAt: "2099-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 1,
      },
      { enabled: true, method: "SMS", enabledAt: null, recoveryCodesRemaining: 1 },
      { enabled: false, method: "EMAIL", enabledAt: null, recoveryCodesRemaining: 0 },
      {
        enabled: false,
        method: null,
        enabledAt: "2099-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 0,
      },
      { enabled: false, method: null, enabledAt: null, recoveryCodesRemaining: 1 },
      { enabled: true, method: "EMAIL", enabledAt: "bad", recoveryCodesRemaining: 1 },
      {
        enabled: true,
        method: "EMAIL",
        enabledAt: "2099-07-16T12:00:00.000Z",
        recoveryCodesRemaining: -1,
      },
      {
        enabled: true,
        method: "EMAIL",
        enabledAt: "2099-07-16T12:00:00.000Z",
        recoveryCodesRemaining: 1.2,
      },
    ]) {
      expect(() => parseTwoFactorStatus(body)).toThrow(ApiError);
    }
  });

  it("validates UUID v4 challenges only", () => {
    expect(parseTwoFactorChallenge(challenge)).toMatchObject({
      challengeId: challenge.challengeId,
    });
    for (const challengeId of [
      "123e4567-e89b-12d3-a456-426614174000",
      "123e4567-e89b-52d3-a456-426614174000",
      "not-a-uuid",
    ]) {
      expect(() =>
        parseTwoFactorChallenge({
          challengeId,
          expiresAt: "2099-07-16T12:00:00.000Z",
        }),
      ).toThrow(ApiError);
    }
  });

  it("sends Authorization, CSRF and exact payloads", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok(challenge))
      .mockResolvedValueOnce(await ok({ recoveryCodes }))
      .mockResolvedValueOnce(await ok(challenge))
      .mockResolvedValueOnce(await ok({ message: "done" }))
      .mockResolvedValueOnce(await ok({ message: "2FA desativado. Faça login novamente." }));
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
      recoveryCode: "ABCDE-12345-FGHIJ",
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
      recoveryCode: "ABCDE-12345-FGHIJ",
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

  it("accepts real recovery codes and rejects old/lowercase/duplicate/wrong counts", () => {
    expect(parseTwoFactorEnrollConfirmResponse({ recoveryCodes })).toEqual({ recoveryCodes });
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...recoveryCodes.slice(0, 9), "WXYZ-1234-QRST"],
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...recoveryCodes.slice(0, 9), "abcde-12345-fghij"],
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...recoveryCodes.slice(0, 9), recoveryCodes[0]],
      }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({ recoveryCodes: recoveryCodes.slice(0, 9) }),
    ).toThrow(ApiError);
    expect(() =>
      parseTwoFactorEnrollConfirmResponse({
        recoveryCodes: [...recoveryCodes, "KLMNO-12345-PQRST"],
      }),
    ).toThrow(ApiError);
  });

  it("rejects malformed bodies and parses disable responses strictly", async () => {
    fetchMock.mockResolvedValueOnce(
      await ok({ challengeId: "bad", expiresAt: "2099-07-16T12:00:00.000Z" }),
    );
    await expect(
      twoFactorSecurityService.requestEnrollment({ method: "SMS", currentPassword: "secret" }),
    ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    for (const response of [
      new Response(null, { status: 200 }),
      new Response("<html></html>", { status: 200 }),
      new Response("{", { status: 200 }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(twoFactorSecurityService.getStatus()).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    }
    expect(parseTwoFactorDisableConfirmResponse({ message: "done" })).toEqual({ message: "done" });
    for (const body of [
      undefined,
      {},
      { message: "" },
      { message: "   " },
      { message: "done", leaked: true },
    ]) {
      expect(() => parseTwoFactorDisableConfirmResponse(body)).toThrow(ApiError);
    }

    for (const response of [
      new Response(null, { status: 200 }),
      new Response("<html></html>", { status: 200 }),
      new Response("{", { status: 200 }),
      await ok({}),
      await ok({ message: "" }),
      await ok({ message: "done", leaked: true }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(
        twoFactorSecurityService.confirmDisable({
          challengeId: challenge.challengeId,
          code: "654321",
        }),
      ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    }
  });

  it("validates method-change challenge, grant and confirm parsers", () => {
    const now = new Date("2099-07-16T12:00:00.000Z");
    const future = "2099-07-16T12:05:00.000Z";
    expect(
      parseMethodChangeChallenge({ challengeId: challenge.challengeId, expiresAt: future }, now),
    ).toEqual({
      challengeId: challenge.challengeId,
      expiresAt: future,
      message: "Código enviado.",
    });
    expect(
      parseStepUpChallenge(
        { ...challenge, expiresAt: future, scope: "TWO_FACTOR_METHOD_CHANGE", method: "EMAIL" },
        now,
      ),
    ).toMatchObject({ scope: "TWO_FACTOR_METHOD_CHANGE", method: "EMAIL" });
    expect(
      parseStepUpGrant(
        { stepUpToken: "opaque", scope: "TWO_FACTOR_METHOD_CHANGE", expiresAt: future },
        now,
      ),
    ).toMatchObject({ stepUpToken: "opaque" });
    expect(parseMethodChangeConfirmResponse({ methodChanged: true })).toEqual({
      methodChanged: true,
    });
    for (const body of [
      { ...challenge, expiresAt: "2099-07-16T11:59:00.000Z" },
      { ...challenge, expiresAt: "bad" },
      { challengeId: challenge.challengeId },
      { ...challenge, expiresAt: future, extra: true },
      { challengeId: "123e4567-e89b-12d3-a456-426614174000", expiresAt: future },
      { challengeId: "123e4567-e89b-52d3-a456-426614174000", expiresAt: future },
      { challengeId: "not-a-uuid", expiresAt: future },
    ]) {
      expect(() => parseMethodChangeChallenge(body, now)).toThrow(ApiError);
    }
    for (const body of [
      { stepUpToken: "", scope: "TWO_FACTOR_METHOD_CHANGE", expiresAt: future },
      { stepUpToken: "opaque", scope: "BAD", expiresAt: future },
      {
        stepUpToken: "opaque",
        scope: "TWO_FACTOR_METHOD_CHANGE",
        expiresAt: "2099-07-16T11:59:00.000Z",
      },
      { stepUpToken: "opaque", scope: "TWO_FACTOR_METHOD_CHANGE", expiresAt: future, extra: true },
      { methodChanged: false },
      { methodChanged: true, extra: true },
    ]) {
      expect(() =>
        "methodChanged" in (body as Record<string, unknown>)
          ? parseMethodChangeConfirmResponse(body)
          : parseStepUpGrant(body, now),
      ).toThrow(ApiError);
    }
  });

  it("calls step-up and method-change endpoints with exact headers and without token in bodies", async () => {
    const grant = {
      stepUpToken: "opaque-step-up-token",
      scope: "TWO_FACTOR_METHOD_CHANGE",
      expiresAt: "2099-07-16T12:10:00.000Z",
    };
    fetchMock
      .mockResolvedValueOnce(
        await ok({ ...challenge, scope: "TWO_FACTOR_METHOD_CHANGE", method: "EMAIL" }),
      )
      .mockResolvedValueOnce(await ok(grant))
      .mockResolvedValueOnce(
        await ok({ ...challenge, scope: "TWO_FACTOR_METHOD_CHANGE", method: "EMAIL" }),
      )
      .mockResolvedValueOnce(
        await ok({ challengeId: challenge.challengeId, expiresAt: challenge.expiresAt }),
      )
      .mockResolvedValueOnce(
        await ok({ challengeId: challenge.challengeId, expiresAt: challenge.expiresAt }),
      )
      .mockResolvedValueOnce(await ok({ methodChanged: true }));
    await twoFactorSecurityService.requestStepUp({
      scope: "TWO_FACTOR_METHOD_CHANGE",
      currentPassword: "secret",
    });
    await twoFactorSecurityService.verifyStepUp({
      challengeId: challenge.challengeId,
      code: "123456",
    });
    await twoFactorSecurityService.resendStepUp({ challengeId: challenge.challengeId });
    await twoFactorSecurityService.requestMethodChange({ newMethod: "EMAIL" }, grant.stepUpToken);
    await twoFactorSecurityService.requestMethodChange({ newMethod: "SMS" }, grant.stepUpToken);
    await twoFactorSecurityService.confirmMethodChange(
      { challengeId: challenge.challengeId, code: "654321" },
      grant.stepUpToken,
    );
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/step-up/request");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scope: "TWO_FACTOR_METHOD_CHANGE",
      currentPassword: "secret",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: challenge.challengeId,
      code: "123456",
    });
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      challengeId: challenge.challengeId,
    });
    expect(fetchMock.mock.calls[3][1].headers.get("X-Step-Up-Token")).toBe(grant.stepUpToken);
    expect(fetchMock.mock.calls[5][1].headers.get("X-Step-Up-Token")).toBe(grant.stepUpToken);
    expect(JSON.stringify(JSON.parse(fetchMock.mock.calls[3][1].body))).not.toContain(
      grant.stepUpToken,
    );
    expect(JSON.parse(fetchMock.mock.calls[3][1].body)).toEqual({ newMethod: "EMAIL" });
    expect(JSON.parse(fetchMock.mock.calls[4][1].body)).toEqual({ newMethod: "SMS" });
    expect(JSON.parse(fetchMock.mock.calls[5][1].body)).toEqual({
      challengeId: challenge.challengeId,
      code: "654321",
    });
  });

  it("classifies ambiguous method-change outcomes without masking explicit 4xx", async () => {
    for (const error of [
      new ApiError(502, "MALFORMED_RESPONSE", "bad"),
      new ApiError(0, "NETWORK_ERROR", "net"),
      new ApiError(503, "INTERNAL_ERROR", "server"),
      new TypeError("network"),
    ]) {
      expect(isMethodChangeOutcomeUnknown(error)).toBe(true);
    }
    for (const error of [
      new ApiError(400, "INVALID_OR_EXPIRED_STEP_UP_GRANT", "bad"),
      new ApiError(400, "STEP_UP_SCOPE_MISMATCH", "bad"),
      new ApiError(400, "STEP_UP_REQUIRED", "bad"),
      new ApiError(401, "INVALID_SESSION", "bad"),
      new ApiError(403, "FORBIDDEN", "bad"),
      new ApiError(400, "INVALID_OR_EXPIRED_2FA_CODE", "bad"),
      new ApiError(429, "RATE_LIMITED", "bad"),
    ]) {
      expect(isMethodChangeOutcomeUnknown(error)).toBe(false);
    }
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "INTERNAL_ERROR", message: "server" }), { status: 503 }),
    );
    await expect(
      twoFactorSecurityService.confirmMethodChange(
        { challengeId: challenge.challengeId, code: "654321" },
        "opaque",
      ),
    ).rejects.toMatchObject({ code: "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN" });
  });

  it("normalizes recovery codes for disable input", () => {
    expect(normalizeRecoveryCode("abcde12345fghij")).toBe("ABCDE-12345-FGHIJ");
    expect(normalizeRecoveryCode("abcde-12345-fghij-extra")).toBe("ABCDE-12345-FGHIJ");
  });
});
