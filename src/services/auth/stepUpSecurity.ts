import { ApiError, apiFetch } from "@/lib/api/client";
import {
  normalizeRecoveryCode,
  recoveryCodePattern,
  type TwoFactorMethod,
} from "./twoFactorSecurity";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const stepUpRecoveryRegenerateScope = "TWO_FACTOR_RECOVERY_REGENERATE" as const;
type StepUpScope = typeof stepUpRecoveryRegenerateScope;
type RecordValue = Record<string, unknown>;

export type StepUpChallenge = {
  challengeId: string;
  scope: StepUpScope;
  method: TwoFactorMethod;
  expiresAt: string;
};
export type StepUpVerifyPayload =
  | { challengeId: string; code: string; recoveryCode?: never }
  | { challengeId: string; recoveryCode: string; code?: never };
type StepUpGrant = { stepUpToken: string; scope: StepUpScope; expiresAt: string };
export type RecoveryCodesResponse = { recoveryCodes: string[] };

function malformed(): never {
  throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
}
function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) malformed();
  return value as RecordValue;
}
function validDateString(value: unknown, future = false): value is string {
  if (typeof value !== "string") return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return !future || time > Date.now();
}
function parseChallenge(value: unknown): StepUpChallenge {
  const body = asRecord(value);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) malformed();
  if (body.scope !== stepUpRecoveryRegenerateScope) malformed();
  if (body.method !== "EMAIL" && body.method !== "SMS") malformed();
  if (!validDateString(body.expiresAt)) malformed();
  return {
    challengeId: body.challengeId,
    scope: body.scope,
    method: body.method,
    expiresAt: body.expiresAt,
  };
}
function parseGrant(value: unknown): StepUpGrant {
  const body = asRecord(value);
  if (typeof body.stepUpToken !== "string" || body.stepUpToken.trim().length < 16) malformed();
  if (body.scope !== stepUpRecoveryRegenerateScope) malformed();
  if (!validDateString(body.expiresAt, true)) malformed();
  return { stepUpToken: body.stepUpToken, scope: body.scope, expiresAt: body.expiresAt };
}
function parseRecoveryCodes(value: unknown): RecoveryCodesResponse {
  const body = asRecord(value);
  if (!Array.isArray(body.recoveryCodes) || body.recoveryCodes.length !== 10) malformed();
  const seen = new Set<string>();
  const recoveryCodes = body.recoveryCodes.map((item) => {
    if (typeof item !== "string" || !recoveryCodePattern.test(item) || seen.has(item)) malformed();
    seen.add(item);
    return item;
  });
  return { recoveryCodes };
}

export function buildStepUpVerifyPayload(
  challengeId: string,
  code: string,
  recoveryCode: string,
): StepUpVerifyPayload {
  const hasCode = code.length > 0;
  const normalizedRecovery = normalizeRecoveryCode(recoveryCode);
  const hasRecoveryInput = recoveryCode.trim().length > 0;
  if (hasCode && hasRecoveryInput)
    throw new ApiError(400, "INVALID_2FA_INPUT", "Entrada inválida.");
  if (!hasCode && !hasRecoveryInput)
    throw new ApiError(400, "INVALID_2FA_INPUT", "Entrada inválida.");
  if (hasCode) {
    if (!/^\d{6}$/.test(code)) throw new ApiError(400, "INVALID_2FA_INPUT", "Entrada inválida.");
    return { challengeId, code };
  }
  if (!recoveryCodePattern.test(normalizedRecovery)) {
    throw new ApiError(400, "INVALID_RECOVERY_CODE", "Recovery code inválido.");
  }
  return { challengeId, recoveryCode: normalizedRecovery };
}

export const stepUpSecurityService = {
  requestStepUp: async (currentPassword: string) =>
    parseChallenge(
      await apiFetch<unknown>("/auth/step-up/request", {
        method: "POST",
        body: json({ scope: stepUpRecoveryRegenerateScope, currentPassword }),
      }),
    ),
  verifyStepUp: async (payload: StepUpVerifyPayload) =>
    parseGrant(
      await apiFetch<unknown>("/auth/step-up/verify", { method: "POST", body: json(payload) }),
    ),
  resendStepUp: async (challengeId: string) =>
    parseChallenge(
      await apiFetch<unknown>("/auth/step-up/resend", {
        method: "POST",
        body: json({ challengeId }),
      }),
    ),
  regenerateRecoveryCodes: async (stepUpToken: string) =>
    parseRecoveryCodes(
      await apiFetch<unknown>("/auth/2fa/recovery/regenerate", {
        method: "POST",
        headers: { "X-Step-Up-Token": stepUpToken },
      }),
    ),
  verifyStepUpAndRegenerateRecoveryCodes: async (payload: StepUpVerifyPayload) => {
    let token = "";
    try {
      const grant = await stepUpSecurityService.verifyStepUp(payload);
      token = grant.stepUpToken;
      return await stepUpSecurityService.regenerateRecoveryCodes(token);
    } finally {
      token = "";
    }
  },
};
