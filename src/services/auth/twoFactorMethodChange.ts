import { ApiError, apiFetch } from "@/lib/api/client";
import { type TwoFactorMethod } from "./twoFactorSecurity";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const methodChangeOutcomeUnknownCode = "TWO_FACTOR_METHOD_CHANGE_OUTCOME_UNKNOWN" as const;

type RecordValue = Record<string, unknown>;
export type TwoFactorMethodChangeChallenge = { challengeId: string; expiresAt: string };
export type TwoFactorMethodChangeConfirmResponse = { methodChanged: true };
export type TwoFactorMethodChangeRequestPayload = { newMethod: TwoFactorMethod };
export type TwoFactorMethodChangeConfirmPayload = { challengeId: string; code: string };

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
function exactKeys(body: RecordValue, keys: string[]) {
  if (Object.keys(body).some((key) => !keys.includes(key))) malformed();
}
export function parseMethodChangeChallenge(value: unknown): TwoFactorMethodChangeChallenge {
  const body = asRecord(value);
  exactKeys(body, ["challengeId", "expiresAt"]);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) malformed();
  if (!validDateString(body.expiresAt)) malformed();
  return { challengeId: body.challengeId, expiresAt: body.expiresAt };
}
export function parseMethodChangeConfirmResponse(
  value: unknown,
): TwoFactorMethodChangeConfirmResponse {
  const body = asRecord(value);
  exactKeys(body, ["methodChanged"]);
  if (body.methodChanged !== true) malformed();
  return { methodChanged: true };
}
function withStepUpToken(stepUpToken: string) {
  if (!stepUpToken.trim()) throw new ApiError(400, "STEP_UP_REQUIRED", "Step-up obrigatório.");
  return { "X-Step-Up-Token": stepUpToken };
}
function isAmbiguousConfirmFailure(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  if (error.code === "MALFORMED_RESPONSE") return true;
  return error.code === "HTTP_ERROR" && error.status >= 500;
}
export function unknownMethodChangeOutcome(error: unknown): ApiError {
  return new ApiError(
    error instanceof ApiError ? error.status : 0,
    methodChangeOutcomeUnknownCode,
    "Não foi possível confirmar o resultado da troca do método de 2FA.",
    error instanceof ApiError ? error.requestId : undefined,
  );
}

export const twoFactorMethodChangeService = {
  request: async (payload: TwoFactorMethodChangeRequestPayload, stepUpToken: string) =>
    parseMethodChangeChallenge(
      await apiFetch<unknown>("/auth/2fa/method/change/request", {
        method: "POST",
        headers: withStepUpToken(stepUpToken),
        body: json(payload),
      }),
    ),
  confirm: async (payload: TwoFactorMethodChangeConfirmPayload, stepUpToken: string) => {
    try {
      return parseMethodChangeConfirmResponse(
        await apiFetch<unknown>("/auth/2fa/method/change/confirm", {
          method: "POST",
          headers: withStepUpToken(stepUpToken),
          body: json(payload),
        }),
      );
    } catch (error) {
      if (isAmbiguousConfirmFailure(error)) throw unknownMethodChangeOutcome(error);
      throw error;
    }
  },
};
