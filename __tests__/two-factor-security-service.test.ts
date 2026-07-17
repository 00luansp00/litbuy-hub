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
  recoveryRegenerationOutcomeUnknownCode,
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
const nextStepUpChallenge = {
  ...stepUpChallenge,
  challengeId: "223e4567-e89b-42d3-a456-826614174001",
  method: "SMS" as const,
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

  it("covers request EMAIL/SMS, malformed transport, refresh and refresh failure", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok(stepUpChallenge))
      .mockResolvedValueOnce(await ok({ ...stepUpChallenge, method: "SMS" }));
    await expect(stepUpSecurityService.requestStepUp("secret-email")).resolves.toMatchObject({
      method: "EMAIL",
    });
    await expect(stepUpSecurityService.requestStepUp("secret-sms")).resolves.toMatchObject({
      method: "SMS",
    });
    for (const response of [
      new Response(null, { status: 200 }),
      new Response("<html></html>", { status: 200 }),
      new Response("{", { status: 200 }),
    ]) {
      fetchMock.mockResolvedValueOnce(response);
      await expect(stepUpSecurityService.requestStepUp("secret")).rejects.toMatchObject({
        code: "MALFORMED_RESPONSE",
      });
    }
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ accessToken: "fresh-step-up" }), { status: 200 }),
      )
      .mockResolvedValueOnce(await ok(stepUpChallenge));
    await stepUpSecurityService.requestStepUp("secret");
    expect(getAccessToken()).toBe("fresh-step-up");
    fetchMock
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_SESSION" }), { status: 401 }),
      );
    await expect(stepUpSecurityService.requestStepUp("secret")).rejects.toBeInstanceOf(ApiError);
    expect(getAccessToken()).toBeNull();
  });

  it("covers verify by code/recovery, resend errors and regenerate error contracts", async () => {
    fetchMock
      .mockResolvedValueOnce(await ok(stepUpGrant))
      .mockResolvedValueOnce(await ok(stepUpGrant))
      .mockResolvedValueOnce(await ok(nextStepUpChallenge))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "RATE_LIMITED" }), { status: 429 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "STEP_UP_DELIVERY_UNAVAILABLE" }), { status: 503 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_OR_EXPIRED_STEP_UP_CODE" }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "INVALID_OR_EXPIRED_STEP_UP_GRANT" }), { status: 400 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ code: "STEP_UP_SCOPE_MISMATCH" }), { status: 400 }),
      )
      .mockResolvedValueOnce(await ok({ recoveryCodes }));
    await stepUpSecurityService.verifyStepUp({
      challengeId: stepUpChallenge.challengeId,
      code: "123456",
    });
    await stepUpSecurityService.verifyStepUp({
      challengeId: stepUpChallenge.challengeId,
      recoveryCode: "ABCDE-12345-FGHIJ",
    });
    await expect(stepUpSecurityService.resendStepUp(stepUpChallenge.challengeId)).resolves.toEqual(
      nextStepUpChallenge,
    );
    await expect(
      stepUpSecurityService.resendStepUp(stepUpChallenge.challengeId),
    ).rejects.toMatchObject({ code: "RATE_LIMITED" });
    await expect(
      stepUpSecurityService.resendStepUp(stepUpChallenge.challengeId),
    ).rejects.toMatchObject({ code: "STEP_UP_DELIVERY_UNAVAILABLE" });
    await expect(
      stepUpSecurityService.resendStepUp(stepUpChallenge.challengeId),
    ).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_STEP_UP_CODE" });
    await expect(
      stepUpSecurityService.regenerateRecoveryCodes("opaque-token-value"),
    ).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_STEP_UP_GRANT" });
    await expect(
      stepUpSecurityService.regenerateRecoveryCodes("opaque-token-value"),
    ).rejects.toMatchObject({ code: "STEP_UP_SCOPE_MISMATCH" });
    await stepUpSecurityService.regenerateRecoveryCodes("opaque-token-value");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      challengeId: stepUpChallenge.challengeId,
      code: "123456",
    });
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({
      challengeId: stepUpChallenge.challengeId,
      recoveryCode: "ABCDE-12345-FGHIJ",
    });
    const regenerateCall = fetchMock.mock.calls.at(-1);
    expect(regenerateCall?.[1].headers.get("X-Step-Up-Token")).toBe("opaque-token-value");
    expect(regenerateCall?.[1].body).toBeUndefined();
  });

  it("classifies only ambiguous failures after a valid grant", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ code: "INVALID_OR_EXPIRED_STEP_UP_CODE" }), { status: 400 }),
    );
    await expect(
      stepUpSecurityService.verifyStepUpAndRegenerateRecoveryCodes({
        challengeId: stepUpChallenge.challengeId,
        code: "123456",
      }),
    ).rejects.toMatchObject({ code: "INVALID_OR_EXPIRED_STEP_UP_CODE" });

    for (const response of [
      new Response(null, { status: 200 }),
      Promise.reject(new TypeError("network failed")),
      new Response(JSON.stringify({ code: "HTTP_ERROR" }), { status: 503 }),
    ]) {
      fetchMock.mockResolvedValueOnce(await ok(stepUpGrant));
      if (response instanceof Promise)
        fetchMock.mockRejectedValueOnce(await response.catch((e) => e));
      else fetchMock.mockResolvedValueOnce(response);
      await expect(
        stepUpSecurityService.verifyStepUpAndRegenerateRecoveryCodes({
          challengeId: stepUpChallenge.challengeId,
          code: "123456",
        }),
      ).rejects.toMatchObject({ code: recoveryRegenerationOutcomeUnknownCode });
    }
  });

  it("preserves explicit regeneration rejections after a valid grant", async () => {
    for (const code of [
      "INVALID_OR_EXPIRED_STEP_UP_GRANT",
      "STEP_UP_SCOPE_MISMATCH",
      "INVALID_SESSION",
      "FORBIDDEN",
      "RATE_LIMITED",
    ]) {
      fetchMock.mockResolvedValueOnce(await ok(stepUpGrant));
      fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ code }), { status: 400 }));
      await expect(
        stepUpSecurityService.verifyStepUpAndRegenerateRecoveryCodes({
          challengeId: stepUpChallenge.challengeId,
          recoveryCode: "ABCDE-12345-FGHIJ",
        }),
      ).rejects.toMatchObject({ code });
    }
    expect(JSON.stringify(localStorage)).not.toContain("opaque-step-up-token-value");
    expect(JSON.stringify(sessionStorage)).not.toContain("opaque-step-up-token-value");
    expect(location.href).not.toContain("opaque-step-up-token-value");
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
