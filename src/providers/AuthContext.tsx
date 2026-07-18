import { createContext, useContext } from "react";
import type { AuthStatus, AuthUser, LoginResult, RegisterPayload, UserRole } from "@/services/auth";

export interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initializing: boolean;
  loading: boolean;
  status: AuthStatus;
  activeRole: UserRole;
  /** @deprecated use hasSellerAccess; SellerProfile is a future domain. */
  hasSellerProfile: boolean;
  hasSellerAccess: boolean;
  isAdmin: boolean;
  twoFactorChallenge: Extract<LoginResult, { status: "twoFactorRequired" }> | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (payload: RegisterPayload) => Promise<void>;
  verifyEmail: (token: string) => Promise<void>;
  approveDevice: (token: string) => Promise<void>;
  verifyTwoFactorLogin: (payload: { code?: string; recoveryCode?: string }) => Promise<AuthUser>;
  resendTwoFactorLogin: () => Promise<void>;
  resendEmailVerification: (email: string) => Promise<void>;
  resendDeviceApproval: (email: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (token: string, newPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  clearAuthentication: () => void;
  switchToBuyer: () => void;
  switchToSeller: () => { ok: boolean; needsOnboarding: boolean };
  toggleRole: () => { ok: boolean; needsOnboarding: boolean; role: UserRole };
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
