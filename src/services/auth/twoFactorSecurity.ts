import { ApiError, apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const recoveryCodePattern = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;

export type TwoFactorMethod = "EMAIL" | "SMS";
export type TwoFactorStatus = {
  enabled: boolean;
  method: TwoFactorMethod | null;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
};
export type TwoFactorEnrollRequestPayload = {
  method: TwoFactorMethod;
  currentPassword: string;
};
export type TwoFactorChallengeResponse = { challengeId: string; expiresAt: string };
export type TwoFactorEnrollConfirmPayload = { challengeId: string; code: string };
export type TwoFactorEnrollConfirmResponse = { recoveryCodes: string[] };
export type TwoFactorDisableRequestPayload = { currentPassword: string };
export type TwoFactorDisableConfirmPayload =
  | { challengeId: string; code: string; recoveryCode?: never }
  | { challengeId: string; recoveryCode: string; code?: never };
export type TwoFactorDisableConfirmResponse = { message: string };

type RecordValue = Record<string, unknown>;

function malformed(): never {
  throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
}

function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) malformed();
  return value as RecordValue;
}

function validDateString(value: unknown) {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function parseChallenge(value: unknown): TwoFactorChallengeResponse {
  const body = asRecord(value);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) malformed();
  if (!validDateString(body.expiresAt)) malformed();
  return { challengeId: body.challengeId, expiresAt: body.expiresAt as string };
}

export function parseTwoFactorStatus(value: unknown): TwoFactorStatus {
  const body = asRecord(value);
  if (typeof body.enabled !== "boolean") malformed();
  const method = body.method;
  if (method !== "EMAIL" && method !== "SMS" && method !== null) malformed();
  if (body.enabled && method === null) malformed();
  if (!body.enabled && method !== null) malformed();
  if (body.enabledAt !== null && !validDateString(body.enabledAt)) malformed();
  if (!Number.isInteger(body.recoveryCodesRemaining) || Number(body.recoveryCodesRemaining) < 0)
    malformed();
  return {
    enabled: body.enabled,
    method,
    enabledAt: body.enabledAt as string | null,
    recoveryCodesRemaining: body.recoveryCodesRemaining as number,
  };
}

export function parseTwoFactorChallengeResponse(value: unknown): TwoFactorChallengeResponse {
  return parseChallenge(value);
}

export function parseTwoFactorEnrollConfirmResponse(
  value: unknown,
): TwoFactorEnrollConfirmResponse {
  const body = asRecord(value);
  if (!Array.isArray(body.recoveryCodes) || body.recoveryCodes.length !== 10) malformed();
  const seen = new Set<string>();
  for (const code of body.recoveryCodes) {
    if (typeof code !== "string" || !recoveryCodePattern.test(code) || seen.has(code)) malformed();
    seen.add(code);
  }
  return { recoveryCodes: [...seen] };
}

export function parseTwoFactorDisableConfirmResponse(
  value: unknown,
): TwoFactorDisableConfirmResponse {
  if (value === undefined) return { message: "2FA desativado. Entre novamente para continuar." };
  const body = asRecord(value);
  return {
    message:
      typeof body.message === "string" && body.message.trim()
        ? body.message
        : "2FA desativado. Entre novamente para continuar.",
  };
}

export const twoFactorSecurityService = {
  getTwoFactorStatus: async () => parseTwoFactorStatus(await apiFetch<unknown>("/auth/2fa/status")),
  requestTwoFactorEnrollment: async (payload: TwoFactorEnrollRequestPayload) =>
    parseTwoFactorChallengeResponse(
      await apiFetch<unknown>("/auth/2fa/enroll/request", {
        method: "POST",
        body: json(payload),
      }),
    ),
  confirmTwoFactorEnrollment: async (payload: TwoFactorEnrollConfirmPayload) =>
    parseTwoFactorEnrollConfirmResponse(
      await apiFetch<unknown>("/auth/2fa/enroll/confirm", {
        method: "POST",
        body: json(payload),
      }),
    ),
  requestTwoFactorDisable: async (payload: TwoFactorDisableRequestPayload) =>
    parseTwoFactorChallengeResponse(
      await apiFetch<unknown>("/auth/2fa/disable/request", {
        method: "POST",
        body: json(payload),
      }),
    ),
  confirmTwoFactorDisable: async (payload: TwoFactorDisableConfirmPayload) =>
    parseTwoFactorDisableConfirmResponse(
      await apiFetch<unknown>("/auth/2fa/disable/confirm", {
        method: "POST",
        body: json(payload),
      }),
    ),
};
