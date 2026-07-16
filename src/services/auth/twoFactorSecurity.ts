import { ApiError, apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const recoveryCode = /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){2,}$/;

export type TwoFactorMethod = "EMAIL" | "SMS";
export type TwoFactorStatus = {
  enabled: boolean;
  method: TwoFactorMethod | null;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
};
export type TwoFactorChallenge = { challengeId: string; expiresAt: string; message: string };
export type TwoFactorEnrollRequestPayload = { method: TwoFactorMethod; currentPassword: string };
export type TwoFactorEnrollConfirmPayload = { challengeId: string; code: string };
export type TwoFactorEnrollConfirmResponse = { recoveryCodes: string[] };
export type TwoFactorDisableRequestPayload = { currentPassword: string };
export type TwoFactorDisableConfirmPayload =
  | { challengeId: string; code: string; recoveryCode?: never }
  | { challengeId: string; recoveryCode: string; code?: never };

type RecordValue = Record<string, unknown>;

function malformed(): never {
  throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
}

function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) malformed();
  return value as RecordValue;
}

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function validDateString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function parseTwoFactorStatus(value: unknown): TwoFactorStatus {
  const body = asRecord(value);
  const method = body.method;
  const enabledAt = body.enabledAt;
  const remaining = body.recoveryCodesRemaining;
  if (typeof body.enabled !== "boolean") malformed();
  if (method !== "EMAIL" && method !== "SMS" && method !== null) malformed();
  if (enabledAt !== null && !validDateString(enabledAt)) malformed();
  if (!Number.isInteger(remaining) || (remaining as number) < 0) malformed();
  if (body.enabled) {
    if (method === null || enabledAt === null) malformed();
  } else if (method !== null || enabledAt !== null || remaining !== 0) malformed();
  return {
    enabled: body.enabled,
    method,
    enabledAt,
    recoveryCodesRemaining: remaining as number,
  };
}

export function parseTwoFactorChallenge(value: unknown): TwoFactorChallenge {
  const body = asRecord(value);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) malformed();
  if (!validDateString(body.expiresAt)) malformed();
  return {
    challengeId: body.challengeId,
    expiresAt: body.expiresAt,
    message: safeMessage(body.message, "Código enviado."),
  };
}

export function parseTwoFactorEnrollConfirmResponse(
  value: unknown,
): TwoFactorEnrollConfirmResponse {
  const body = asRecord(value);
  if (!Array.isArray(body.recoveryCodes) || body.recoveryCodes.length !== 10) malformed();
  const seen = new Set<string>();
  const recoveryCodes = body.recoveryCodes.map((item) => {
    if (typeof item !== "string" || !recoveryCode.test(item) || seen.has(item)) malformed();
    seen.add(item);
    return item;
  });
  return { recoveryCodes };
}

export const twoFactorSecurityService = {
  getStatus: async () => parseTwoFactorStatus(await apiFetch<unknown>("/auth/2fa/status")),
  requestEnrollment: async (payload: TwoFactorEnrollRequestPayload) =>
    parseTwoFactorChallenge(
      await apiFetch<unknown>("/auth/2fa/enroll/request", { method: "POST", body: json(payload) }),
    ),
  confirmEnrollment: async (payload: TwoFactorEnrollConfirmPayload) =>
    parseTwoFactorEnrollConfirmResponse(
      await apiFetch<unknown>("/auth/2fa/enroll/confirm", { method: "POST", body: json(payload) }),
    ),
  requestDisable: async (payload: TwoFactorDisableRequestPayload) =>
    parseTwoFactorChallenge(
      await apiFetch<unknown>("/auth/2fa/disable/request", { method: "POST", body: json(payload) }),
    ),
  confirmDisable: (payload: TwoFactorDisableConfirmPayload) =>
    apiFetch<{ message?: string }>("/auth/2fa/disable/confirm", {
      method: "POST",
      body: json(payload),
    }),
};
