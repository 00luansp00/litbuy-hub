export type UserRole = "buyer" | "seller";
export type PlatformRole = "buyer" | "seller" | "admin";

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
  roles: PlatformRole[];
  displayName: string;
  name: string;
  avatarUrl?: string;
  /** @deprecated Seller profile is a future domain; use hasSellerAccess from AuthContext. */
  sellerSlug?: string | null;
  sellerName?: string | null;
  /** Presentation preference only; never backend authorization. */
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
