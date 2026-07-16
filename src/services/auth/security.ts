import { apiFetch } from "@/lib/api/client";

const json = (body: unknown) => JSON.stringify(body);

export type AuthSession = {
  id: string;
  deviceId: string;
  deviceName: string | null;
  userAgent: string | null;
  createdAt: string;
  lastUsedAt: string;
  expiresAt: string;
  current: boolean;
  revoked: boolean;
  revokedAt: string | null;
  revocationReason: string | null;
};

export type AuthDevice = {
  id: string;
  displayName: string | null;
  userAgent: string | null;
  status: "PENDING" | "APPROVED" | "REVOKED";
  isInitialDevice: boolean;
  approvedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string | null;
  revokedAt: string | null;
  current: boolean;
};

export type MessageResponse = { message: string };
export type SessionsResponse = { sessions: AuthSession[] };
export type DevicesResponse = { devices: AuthDevice[] };
export type ChangePasswordPayload = { currentPassword: string; newPassword: string };

export const authSecurityService = {
  listSessions: () => apiFetch<SessionsResponse>("/auth/sessions"),
  revokeSession: (sessionId: string) =>
    apiFetch<MessageResponse>(`/auth/sessions/${encodeURIComponent(sessionId)}`, {
      method: "DELETE",
    }),
  logoutAllSessions: () =>
    apiFetch<MessageResponse>("/auth/sessions/logout-all", {
      method: "POST",
    }),
  listDevices: () => apiFetch<DevicesResponse>("/auth/devices"),
  revokeDevice: (deviceId: string) =>
    apiFetch<MessageResponse>(`/auth/devices/${encodeURIComponent(deviceId)}`, {
      method: "DELETE",
    }),
  changePassword: (payload: ChangePasswordPayload) =>
    apiFetch<MessageResponse>("/auth/password/change", {
      method: "POST",
      body: json(payload),
    }),
};
