import { ApiError, apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const recoveryCodePattern = /^[A-Z0-9]{5}-[A-Z0-9]{5}-[A-Z0-9]{5}$/;
export const methodChangeOutcomeUnknownCode = "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN";

export type TwoFactorMethod = "EMAIL" | "SMS";
export type StepUpScope = "TWO_FACTOR_METHOD_CHANGE" | "TWO_FACTOR_RECOVERY_REGENERATE";
export type TwoFactorStatus = {
  enabled: boolean;
  method: TwoFactorMethod | null;
  enabledAt: string | null;
  recoveryCodesRemaining: number;
};
export type TwoFactorChallenge = { challengeId: string; expiresAt: string; message: string };
export type TwoFactorStepUpChallenge = TwoFactorChallenge & {
  scope: StepUpScope;
  method: TwoFactorMethod;
};
export type TwoFactorStepUpGrant = { stepUpToken: string; scope: StepUpScope; expiresAt: string };
export type TwoFactorEnrollRequestPayload = { method: TwoFactorMethod; currentPassword: string };
export type TwoFactorEnrollConfirmPayload = { challengeId: string; code: string };
export type TwoFactorEnrollConfirmResponse = { recoveryCodes: string[] };
export type TwoFactorDisableRequestPayload = { currentPassword: string };
export type TwoFactorDisableConfirmPayload =
  | { challengeId: string; code: string; recoveryCode?: never }
  | { challengeId: string; recoveryCode: string; code?: never };
export type TwoFactorDisableConfirmResponse = { message: string };
export type StepUpVerifyPayload =
  | { challengeId: string; code: string; recoveryCode?: never }
  | { challengeId: string; recoveryCode: string; code?: never };
export type MethodChangeConfirmResponse = { methodChanged: true };

export type MethodChangeApi = {
  requestStepUp: (payload: {
    scope: StepUpScope;
    currentPassword: string;
  }) => Promise<TwoFactorStepUpChallenge>;
  verifyStepUp: (payload: StepUpVerifyPayload) => Promise<TwoFactorStepUpGrant>;
  resendStepUp: (payload: { challengeId: string }) => Promise<TwoFactorStepUpChallenge>;
  requestMethodChange: (
    payload: { newMethod: TwoFactorMethod },
    stepUpToken: string,
  ) => Promise<TwoFactorChallenge>;
  confirmMethodChange: (
    payload: { challengeId: string; code: string },
    stepUpToken: string,
  ) => Promise<MethodChangeConfirmResponse>;
};

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

function assertKnownKeys(body: RecordValue, keys: string[]) {
  const allowed = new Set(keys);
  if (Object.keys(body).some((key) => !allowed.has(key))) malformed();
}

function validFutureDateString(value: unknown, now = new Date()): value is string {
  if (!validDateString(value)) return false;
  return new Date(value).getTime() > now.getTime();
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

export function parseMethodChangeChallenge(value: unknown, now = new Date()): TwoFactorChallenge {
  const body = asRecord(value);
  assertKnownKeys(body, ["challengeId", "expiresAt", "message"]);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) malformed();
  if (!validFutureDateString(body.expiresAt, now)) malformed();
  return {
    challengeId: body.challengeId,
    expiresAt: body.expiresAt,
    message: safeMessage(body.message, "Código enviado."),
  };
}

export function parseStepUpChallenge(value: unknown, now = new Date()): TwoFactorStepUpChallenge {
  const body = asRecord(value);
  assertKnownKeys(body, ["challengeId", "scope", "method", "expiresAt", "message"]);
  const base = parseMethodChangeChallenge(
    { challengeId: body.challengeId, expiresAt: body.expiresAt, message: body.message },
    now,
  );
  if (
    body.scope !== "TWO_FACTOR_METHOD_CHANGE" &&
    body.scope !== "TWO_FACTOR_RECOVERY_REGENERATE"
  ) {
    malformed();
  }
  if (body.method !== "EMAIL" && body.method !== "SMS") malformed();
  return { ...base, scope: body.scope, method: body.method };
}

export function parseStepUpGrant(value: unknown, now = new Date()): TwoFactorStepUpGrant {
  const body = asRecord(value);
  assertKnownKeys(body, ["stepUpToken", "scope", "expiresAt"]);
  if (typeof body.stepUpToken !== "string" || !body.stepUpToken.trim()) malformed();
  if (
    body.scope !== "TWO_FACTOR_METHOD_CHANGE" &&
    body.scope !== "TWO_FACTOR_RECOVERY_REGENERATE"
  ) {
    malformed();
  }
  if (!validFutureDateString(body.expiresAt, now)) malformed();
  return { stepUpToken: body.stepUpToken, scope: body.scope, expiresAt: body.expiresAt };
}

export function parseMethodChangeConfirmResponse(value: unknown): MethodChangeConfirmResponse {
  const body = asRecord(value);
  assertKnownKeys(body, ["methodChanged"]);
  if (body.methodChanged !== true) malformed();
  return { methodChanged: true };
}

export function parseTwoFactorEnrollConfirmResponse(
  value: unknown,
): TwoFactorEnrollConfirmResponse {
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

export function parseTwoFactorDisableConfirmResponse(
  value: unknown,
): TwoFactorDisableConfirmResponse {
  const body = asRecord(value);
  if (
    Object.keys(body).some((key) => key !== "message") ||
    typeof body.message !== "string" ||
    !body.message.trim()
  ) {
    malformed();
  }
  return { message: body.message };
}

export function normalizeRecoveryCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 15)
    .replace(/(.{5})(?=.)/g, "$1-");
}

export function isMethodChangeOutcomeUnknown(error: unknown) {
  if (error instanceof ApiError) {
    return (
      error.code === "MALFORMED_RESPONSE" || error.code === "NETWORK_ERROR" || error.status >= 500
    );
  }
  return error instanceof TypeError;
}

function asUnknownMethodChangeError(error: unknown): ApiError {
  if (error instanceof ApiError && isMethodChangeOutcomeUnknown(error)) {
    return new ApiError(
      error.status,
      methodChangeOutcomeUnknownCode,
      "A troca pode ter sido aplicada, mas não foi possível confirmar o resultado.",
      error.requestId,
    );
  }
  if (error instanceof TypeError) {
    return new ApiError(
      0,
      methodChangeOutcomeUnknownCode,
      "A troca pode ter sido aplicada, mas não foi possível confirmar o resultado.",
    );
  }
  return error instanceof ApiError
    ? error
    : new ApiError(0, "NETWORK_ERROR", "Não foi possível conectar à API.");
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
  confirmDisable: async (payload: TwoFactorDisableConfirmPayload) =>
    parseTwoFactorDisableConfirmResponse(
      await apiFetch<unknown>("/auth/2fa/disable/confirm", {
        method: "POST",
        body: json(payload),
      }),
    ),
  requestStepUp: async (payload: { scope: StepUpScope; currentPassword: string }) =>
    parseStepUpChallenge(
      await apiFetch<unknown>("/auth/step-up/request", { method: "POST", body: json(payload) }),
    ),
  verifyStepUp: async (payload: StepUpVerifyPayload) =>
    parseStepUpGrant(
      await apiFetch<unknown>("/auth/step-up/verify", { method: "POST", body: json(payload) }),
    ),
  resendStepUp: async (payload: { challengeId: string }) =>
    parseStepUpChallenge(
      await apiFetch<unknown>("/auth/step-up/resend", { method: "POST", body: json(payload) }),
    ),
  requestMethodChange: async (payload: { newMethod: TwoFactorMethod }, stepUpToken: string) =>
    parseMethodChangeChallenge(
      await apiFetch<unknown>("/auth/2fa/method/change/request", {
        method: "POST",
        headers: { "X-Step-Up-Token": stepUpToken },
        body: json(payload),
      }),
    ),
  confirmMethodChange: async (
    payload: { challengeId: string; code: string },
    stepUpToken: string,
  ) => {
    try {
      return parseMethodChangeConfirmResponse(
        await apiFetch<unknown>("/auth/2fa/method/change/confirm", {
          method: "POST",
          headers: { "X-Step-Up-Token": stepUpToken },
          body: json(payload),
        }),
      );
    } catch (error) {
      throw asUnknownMethodChangeError(error);
    }
  },
} satisfies MethodChangeApi & Record<string, unknown>;
