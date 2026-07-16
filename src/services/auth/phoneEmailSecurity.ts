import { apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);

export type PhoneRequestPayload = { phone: string; currentPassword: string };
export type PhoneRequestResponse = { challengeId: string; expiresAt: string; message: string };
export type PhoneVerifyPayload = { challengeId: string; code: string; phone: string };
export type EmailChangeRequestPayload = { newEmail: string; currentPassword: string };
export type EmailChangeRequestResponse = { message: string; requestId: string; expiresAt: string };
export type EmailChangeConfirmPayload = { token: string; newEmail: string };
export type EmailChangeConfirmResponse = { status: "PENDING" | "COMPLETED"; message: string };

export const phoneEmailSecurityService = {
  requestPhoneVerification: (payload: PhoneRequestPayload) =>
    apiFetch<PhoneRequestResponse>("/auth/phone/request", {
      method: "POST",
      body: json(payload),
    }),
  verifyPhone: (payload: PhoneVerifyPayload) =>
    apiFetch<{ message: string }>("/auth/phone/verify", {
      method: "POST",
      body: json(payload),
    }),
  requestEmailChange: (payload: EmailChangeRequestPayload) =>
    apiFetch<EmailChangeRequestResponse>("/auth/email/change/request", {
      method: "POST",
      body: json(payload),
    }),
  confirmEmailChange: (payload: EmailChangeConfirmPayload) =>
    apiFetch<EmailChangeConfirmResponse>("/auth/email/change/confirm", {
      method: "POST",
      body: json(payload),
      auth: false,
    }),
};
