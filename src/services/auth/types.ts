export type UserRole = "buyer" | "seller";

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
  /** Contexto visual legado; perfil real de vendedor virá em sprint própria. */
  sellerSlug?: string | null;
  sellerName?: string | null;
  activeRole?: UserRole;
};

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
export type AuthMe = Omit<AuthUser, "displayName" | "name" | "activeRole">;
export type AuthSuccess = { accessToken: string; user: AuthMe };
export type TwoFactorRequired = {
  code: "TWO_FACTOR_REQUIRED";
  challengeId: string;
  method: "EMAIL" | "SMS";
  expiresAt: string;
};
export type DeviceApprovalRequired = { code: "DEVICE_APPROVAL_REQUIRED" };
export type LoginResponse = AuthSuccess | TwoFactorRequired | DeviceApprovalRequired;
export type AuthStatus =
  | "initializing"
  | "anonymous"
  | "authenticated"
  | "emailVerificationRequired"
  | "deviceApprovalRequired"
  | "twoFactorRequired";
export type LoginResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "deviceApprovalRequired" }
  | { status: "twoFactorRequired"; challengeId: string; method: "EMAIL" | "SMS"; expiresAt: string }
  | { status: "emailVerificationRequired" };
