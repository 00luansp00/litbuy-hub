export type AuthUser = {
  id: string;
  email: string;
  emailVerified: boolean;
  phoneVerified: boolean;
  phoneMasked?: string | null;
  birthDate: string;
  status: string;
  createdAt: string;
  sensitiveActionHoldUntil?: string | null;
  sensitiveActionHoldActive?: boolean;
  displayName: string;
  name: string;
  avatarUrl?: string;
  sellerSlug?: string | null;
  sellerName?: string | null;
  activeRole?: UserRole;
};
export type UserRole = "buyer" | "seller";
export type RegisterPayload = {
  email: string;
  password: string;
  birthDate: string;
  termsAccepted: boolean;
  privacyAccepted: boolean;
  termsVersion: string;
  privacyVersion: string;
  deviceName?: string;
};
export type LoginPayload = { email: string; password: string; deviceName?: string };
export type AuthSuccess = { accessToken: string; user: Omit<AuthUser, "displayName"> };
export type TwoFactorRequired = {
  code: "TWO_FACTOR_REQUIRED";
  challengeId: string;
  method: "EMAIL" | "SMS";
  expiresAt: string;
};
export type DeviceApprovalRequired = { code: "DEVICE_APPROVAL_REQUIRED" };
export type ChallengeResult = AuthSuccess | TwoFactorRequired | DeviceApprovalRequired;
