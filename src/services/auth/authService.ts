import { apiFetch } from "@/lib/api/client";
import type {
  AuthMe,
  AuthSuccess,
  LoginPayload,
  LoginResponse,
  PlatformRole,
  RegisterPayload,
} from "./types";
const json = (body: unknown) => JSON.stringify(body);
const validRoles = new Set<PlatformRole>(["buyer", "seller", "admin"]);
export function parseAuthMe(raw: AuthMe): AuthMe {
  if (!Array.isArray(raw.roles)) throw new Error("Resposta de autenticação malformada.");
  const roles = [
    ...new Set(
      raw.roles.filter((role): role is PlatformRole => validRoles.has(role as PlatformRole)),
    ),
  ];
  const order: Record<PlatformRole, number> = { buyer: 0, seller: 1, admin: 2 };
  roles.sort((a, b) => order[a] - order[b]);
  return { ...raw, roles };
}
export const authService = {
  register: (payload: RegisterPayload) =>
    apiFetch<{ message: string }>("/auth/register", {
      method: "POST",
      body: json(payload),
      auth: false,
    }),
  verifyEmail: (token: string) =>
    apiFetch<{ message: string }>("/auth/email/verify", {
      method: "POST",
      body: json({ token }),
      auth: false,
    }),
  resendEmailVerification: (email: string) =>
    apiFetch<{ message: string }>("/auth/email/resend", {
      method: "POST",
      body: json({ email }),
      auth: false,
    }),
  login: (payload: LoginPayload) =>
    apiFetch<LoginResponse>("/auth/login", { method: "POST", body: json(payload), auth: false }),
  approveDevice: (token: string) =>
    apiFetch<{ message: string }>("/auth/device/approve", {
      method: "POST",
      body: json({ token }),
      auth: false,
    }),
  resendDeviceApproval: (email: string) =>
    apiFetch<{ message: string }>("/auth/device/resend", {
      method: "POST",
      body: json({ email }),
      auth: false,
    }),
  verifyTwoFactorLogin: (payload: { challengeId: string; code?: string; recoveryCode?: string }) =>
    apiFetch<AuthSuccess>("/auth/2fa/login/verify", {
      method: "POST",
      body: json(payload),
      auth: false,
    }),
  resendTwoFactorLogin: (challengeId: string) =>
    apiFetch<{ challengeId: string; expiresAt: string }>("/auth/2fa/login/resend", {
      method: "POST",
      body: json({ challengeId }),
      auth: false,
    }),
  forgotPassword: (email: string) =>
    apiFetch<{ message: string }>("/auth/password/forgot", {
      method: "POST",
      body: json({ email }),
      auth: false,
    }),
  resetPassword: (token: string, newPassword: string) =>
    apiFetch<{ message: string }>("/auth/password/reset", {
      method: "POST",
      body: json({ token, newPassword }),
      auth: false,
    }),
  refresh: () =>
    apiFetch<{ accessToken: string }>("/auth/refresh", { method: "POST", skipAuthRefresh: true }),
  logout: () =>
    apiFetch<{ message: string }>("/auth/logout", { method: "POST", skipAuthRefresh: true }),
  me: () => apiFetch<AuthMe>("/auth/me").then(parseAuthMe),
};
export function toDisplayUser(user: AuthMe) {
  const displayName = user.email.split("@")[0];
  return { ...user, displayName, name: displayName };
}
