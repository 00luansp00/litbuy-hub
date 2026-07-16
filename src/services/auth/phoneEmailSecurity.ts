import { ApiError, apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PhoneRequestPayload = { phone: string; currentPassword: string };
export type PhoneRequestResponse = { challengeId: string; expiresAt: string; message: string };
export type PhoneVerifyPayload = { challengeId: string; code: string; phone: string };
export type EmailChangeRequestPayload = { newEmail: string; currentPassword: string };
export type EmailChangeRequestResponse = { message: string; requestId: string; expiresAt: string };
export type EmailChangeConfirmPayload = { token: string; newEmail: string };
export type EmailChangeConfirmResponse = { status: "PENDING" | "COMPLETED"; message: string };

type RecordValue = Record<string, unknown>;

function asRecord(value: unknown): RecordValue {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  return value as RecordValue;
}

function safeMessage(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function validDateString(value: unknown) {
  if (typeof value !== "string") return false;
  const date = new Date(value);
  return !Number.isNaN(date.getTime());
}

export function parsePhoneRequestResponse(value: unknown): PhoneRequestResponse {
  const body = asRecord(value);
  if (typeof body.challengeId !== "string" || !uuidV4.test(body.challengeId)) {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  if (!validDateString(body.expiresAt)) {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  return {
    challengeId: body.challengeId,
    expiresAt: body.expiresAt as string,
    message: safeMessage(body.message, "Código enviado por SMS."),
  };
}

export function parseEmailChangeRequestResponse(value: unknown): EmailChangeRequestResponse {
  const body = asRecord(value);
  if (typeof body.requestId !== "string" || !body.requestId.trim()) {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  if (!validDateString(body.expiresAt)) {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  return {
    requestId: body.requestId,
    expiresAt: body.expiresAt as string,
    message: safeMessage(body.message, "Enviamos confirmações para os dois e-mails."),
  };
}

export function parseEmailChangeConfirmResponse(value: unknown): EmailChangeConfirmResponse {
  const body = asRecord(value);
  if (body.status !== "PENDING" && body.status !== "COMPLETED") {
    throw new ApiError(502, "MALFORMED_RESPONSE", "Resposta inválida da API.");
  }
  return {
    status: body.status,
    message: safeMessage(
      body.message,
      body.status === "COMPLETED"
        ? "E-mail alterado. Faça login novamente."
        : "Confirmação registrada. Aguarde a outra confirmação.",
    ),
  };
}

export const phoneEmailSecurityService = {
  requestPhoneVerification: async (payload: PhoneRequestPayload) =>
    parsePhoneRequestResponse(
      await apiFetch<unknown>("/auth/phone/request", {
        method: "POST",
        body: json(payload),
      }),
    ),
  verifyPhone: (payload: PhoneVerifyPayload) =>
    apiFetch<{ message: string }>("/auth/phone/verify", {
      method: "POST",
      body: json(payload),
    }),
  requestEmailChange: async (payload: EmailChangeRequestPayload) =>
    parseEmailChangeRequestResponse(
      await apiFetch<unknown>("/auth/email/change/request", {
        method: "POST",
        body: json(payload),
      }),
    ),
  confirmEmailChange: async (payload: EmailChangeConfirmPayload) =>
    parseEmailChangeConfirmResponse(
      await apiFetch<unknown>("/auth/email/change/confirm", {
        method: "POST",
        body: json(payload),
        auth: false,
      }),
    ),
};
