import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, getAccessToken, setAccessToken } from "@/lib/api/client";
import {
  normalizeRecoveryCode,
  parseTwoFactorChallenge,
  parseTwoFactorDisableConfirmResponse,
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
          expiresAt: "2026-07-16T12:00:00.000Z",
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
      await ok({ challengeId: "bad", expiresAt: "2026-07-16T12:00:00.000Z" }),
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

  it("normalizes recovery codes for disable input", () => {
    expect(normalizeRecoveryCode("abcde12345fghij")).toBe("ABCDE-12345-FGHIJ");
    expect(normalizeRecoveryCode("abcde-12345-fghij-extra")).toBe("ABCDE-12345-FGHIJ");
  });
});

import {
  buildStepUpVerifyPayload,
  stepUpRecoveryRegenerateScope,
  stepUpSecurityService,
} from "@/services/auth/stepUpSecurity";

const stepUpChallenge = {
  challengeId: "123e4567-e89b-42d3-a456-426614174000",
  scope: stepUpRecoveryRegenerateScope,
  method: "EMAIL",
  expiresAt: "2027-07-16T12:00:00.000Z",
};
const stepUpGrant = {
  stepUpToken: "opaque-step-up-token-value",
  scope: stepUpRecoveryRegenerateScope,
  expiresAt: "2027-07-16T12:00:00.000Z",
};

describe("stepUpSecurityService", () => {
  it("requests, verifies, resends and regenerates with exact contracts", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok(stepUpChallenge))
      .mockResolvedValueOnce(await ok({ ...stepUpChallenge, method: "SMS" }))
      .mockResolvedValueOnce(await ok(stepUpGrant))
      .mockResolvedValueOnce(await ok({ recoveryCodes }));
    await stepUpSecurityService.requestStepUp("secret");
    await stepUpSecurityService.resendStepUp(stepUpChallenge.challengeId);
    await stepUpSecurityService.verifyStepUpAndRegenerateRecoveryCodes({
      challengeId: stepUpChallenge.challengeId,
      code: "123456",
    });
    expect(fetchMock.mock.calls[0][0]).toContain("/auth/step-up/request");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      scope: stepUpRecoveryRegenerateScope,
      currentPassword: "secret",
    });
    expect(fetchMock.mock.calls[1][0]).toContain("/auth/step-up/resend");
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: stepUpChallenge.challengeId,
    });
    expect(fetchMock.mock.calls[2][0]).toContain("/auth/step-up/verify");
    expect(JSON.parse(fetchMock.mock.calls[2][1].body)).toEqual({
      challengeId: stepUpChallenge.challengeId,
      code: "123456",
    });
    expect(fetchMock.mock.calls[3][0]).toContain("/auth/2fa/recovery/regenerate");
    expect(fetchMock.mock.calls[3][1].body).toBeUndefined();
    expect(fetchMock.mock.calls[3][1].headers.get("X-Step-Up-Token")).toBe(
      "opaque-step-up-token-value",
    );
    expect(fetchMock.mock.calls[3][1].headers.get("Authorization")).toBe("Bearer access-token");
    expect(fetchMock.mock.calls[3][1].headers.get("X-CSRF-Token")).toBe("csrf-token");
  });

  it("builds code or normalized recovery payloads, never both or neither", () => {
    expect(buildStepUpVerifyPayload(stepUpChallenge.challengeId, "123456", "")).toEqual({
      challengeId: stepUpChallenge.challengeId,
      code: "123456",
    });
    expect(buildStepUpVerifyPayload(stepUpChallenge.challengeId, "", "abcde12345fghij")).toEqual({
      challengeId: stepUpChallenge.challengeId,
      recoveryCode: "ABCDE-12345-FGHIJ",
    });
    expect(() => buildStepUpVerifyPayload(stepUpChallenge.challengeId, "123", "")).toThrow(
      ApiError,
    );
    expect(() =>
      buildStepUpVerifyPayload(stepUpChallenge.challengeId, "123456", "ABCDE-12345-FGHIJ"),
    ).toThrow(ApiError);
    expect(() => buildStepUpVerifyPayload(stepUpChallenge.challengeId, "", "")).toThrow(ApiError);
  });

  it("rejects malformed step-up challenge, grant and recovery code responses", async () => {
    for (const body of [
      {},
      { ...stepUpChallenge, scope: "TWO_FACTOR_METHOD_CHANGE" },
      { ...stepUpChallenge, challengeId: "123e4567-e89b-12d3-a456-426614174000" },
      { ...stepUpChallenge, method: "PUSH" },
      { ...stepUpChallenge, expiresAt: "bad" },
    ]) {
      fetchMock.mockResolvedValueOnce(await ok(body));
      await expect(stepUpSecurityService.requestStepUp("secret")).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    }
    for (const body of [
      {},
      { ...stepUpGrant, stepUpToken: "" },
      { ...stepUpGrant, stepUpToken: "short" },
      { ...stepUpGrant, scope: "TWO_FACTOR_METHOD_CHANGE" },
      { ...stepUpGrant, expiresAt: "bad" },
      { ...stepUpGrant, expiresAt: "2020-01-01T00:00:00.000Z" },
    ]) {
      fetchMock.mockResolvedValueOnce(await ok(body));
      await expect(
        stepUpSecurityService.verifyStepUp({
          challengeId: stepUpChallenge.challengeId,
          code: "123456",
        }),
      ).rejects.toMatchObject({ code: "MALFORMED_RESPONSE" });
    }
    for (const body of [
      {},
      { recoveryCodes: recoveryCodes.slice(0, 9) },
      { recoveryCodes: [...recoveryCodes, "KLMNO-12345-PQRST"] },
      { recoveryCodes: [...recoveryCodes.slice(0, 9), recoveryCodes[0]] },
      { recoveryCodes: [...recoveryCodes.slice(0, 9), "ABCD-1234-EFGH"] },
      { recoveryCodes: [...recoveryCodes.slice(0, 9), "abcde-12345-fghij"] },
    ]) {
      fetchMock.mockResolvedValueOnce(await ok(body));
      await expect(
        stepUpSecurityService.regenerateRecoveryCodes("opaque-token-value"),
      ).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    }
  });
});
