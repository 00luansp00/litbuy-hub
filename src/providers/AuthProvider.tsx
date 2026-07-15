import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, setAccessToken, setAuthLostHandler } from "@/lib/api/client";
import {
  authService,
  toDisplayUser,
  type AuthUser,
  type LoginPayload,
  type RegisterPayload,
  type UserRole,
  type AuthSuccess,
} from "@/services/auth";

type AuthStatus =
  | "initializing"
  | "anonymous"
  | "authenticated"
  | "emailVerificationRequired"
  | "deviceApprovalRequired"
  | "twoFactorRequired";
type LoginResult =
  | { status: "authenticated"; user: AuthUser }
  | { status: "deviceApprovalRequired" }
  | { status: "twoFactorRequired"; challengeId: string; method: "EMAIL" | "SMS"; expiresAt: string }
  | { status: "emailVerificationRequired" };
interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  initializing: boolean;
  loading: boolean;
  status: AuthStatus;
  activeRole: UserRole;
  hasSellerProfile: boolean;
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
  switchToBuyer: () => void;
  switchToSeller: () => { ok: boolean; needsOnboarding: boolean };
  toggleRole: () => { ok: boolean; needsOnboarding: boolean; role: UserRole };
}
const AuthContext = createContext<AuthContextValue | null>(null);
const demoRoles =
  import.meta.env.MODE !== "production" && import.meta.env.VITE_ENABLE_DEMO_ROLES === "true";
function withPresentation(
  u: Omit<AuthUser, "displayName">,
  activeRole: UserRole = "buyer",
): AuthUser {
  return { ...toDisplayUser(u), activeRole };
}
export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("initializing");
  const [loading, setLoading] = useState(false);
  const [twoFactorChallenge, setTwoFactorChallenge] =
    useState<AuthContextValue["twoFactorChallenge"]>(null);
  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    setTwoFactorChallenge(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public" });
  }, [queryClient]);
  const applySuccess = useCallback(
    async (result: AuthSuccess) => {
      setAccessToken(result.accessToken);
      const fresh = await authService.me();
      const next = withPresentation(fresh);
      setUser(next);
      setStatus("authenticated");
      setTwoFactorChallenge(null);
      queryClient.removeQueries();
      return next;
    },
    [queryClient],
  );
  useEffect(() => {
    setAuthLostHandler(clear);
    if (typeof window === "undefined") return;
    let cancelled = false;
    authService
      .refresh()
      .then(({ accessToken }) => {
        if (cancelled) return;
        setAccessToken(accessToken);
        return authService.me();
      })
      .then((me) => {
        if (cancelled) return;
        if (me) {
          setUser(withPresentation(me));
          setStatus("authenticated");
        } else setStatus("anonymous");
      })
      .catch(() => {
        if (!cancelled) clear();
      });
    return () => {
      cancelled = true;
    };
  }, [clear]);
  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setLoading(true);
      try {
        const result = await authService.login({
          email,
          password,
          deviceName: navigator?.platform || "Navegador",
        } as LoginPayload);
        const next = await applySuccess(result);
        return { status: "authenticated", user: next };
      } catch (e) {
        if (e instanceof ApiError && e.status === 202 && e.code === "DEVICE_APPROVAL_REQUIRED") {
          setStatus("deviceApprovalRequired");
          return { status: "deviceApprovalRequired" };
        }
        if (e instanceof ApiError && e.status === 202 && e.code === "TWO_FACTOR_REQUIRED") {
          const body = e as ApiError & {
            challengeId?: string;
            method?: "EMAIL" | "SMS";
            expiresAt?: string;
          };
          const challenge = {
            status: "twoFactorRequired" as const,
            challengeId: body.challengeId ?? "",
            method: body.method ?? "EMAIL",
            expiresAt: body.expiresAt ?? "",
          };
          setTwoFactorChallenge(challenge);
          setStatus("twoFactorRequired");
          return challenge;
        }
        if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED")
          setStatus("emailVerificationRequired");
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [applySuccess],
  );
  const register = useCallback(async (payload: RegisterPayload) => {
    setLoading(true);
    try {
      await authService.register(payload);
      setStatus("emailVerificationRequired");
    } finally {
      setLoading(false);
    }
  }, []);
  const verifyTwoFactorLogin = useCallback(
    async (payload: { code?: string; recoveryCode?: string }) => {
      if (!twoFactorChallenge?.challengeId) throw new Error("2FA challenge ausente");
      setLoading(true);
      try {
        const next = await applySuccess(
          await authService.verifyTwoFactorLogin({
            challengeId: twoFactorChallenge.challengeId,
            ...payload,
          }),
        );
        return next;
      } finally {
        setLoading(false);
      }
    },
    [applySuccess, twoFactorChallenge],
  );
  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authService.logout();
    } finally {
      clear();
      setLoading(false);
    }
  }, [clear]);
  const refreshSession = useCallback(async () => {
    const r = await authService.refresh();
    setAccessToken(r.accessToken);
    setUser(withPresentation(await authService.me()));
    setStatus("authenticated");
  }, []);
  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: status === "authenticated" && !!user,
      initializing: status === "initializing",
      loading,
      status,
      activeRole: user?.activeRole ?? "buyer",
      hasSellerProfile: true,
      isAdmin: demoRoles && !!user,
      twoFactorChallenge,
      login,
      register,
      verifyEmail: (t) => authService.verifyEmail(t).then(() => {}),
      approveDevice: (t) => authService.approveDevice(t).then(() => {}),
      verifyTwoFactorLogin,
      resendTwoFactorLogin: () =>
        twoFactorChallenge?.challengeId
          ? authService
              .resendTwoFactorLogin(twoFactorChallenge.challengeId)
              .then((r) => setTwoFactorChallenge({ ...twoFactorChallenge, ...r }))
          : Promise.reject(new Error("2FA challenge ausente")),
      resendEmailVerification: (email) => authService.resendEmailVerification(email).then(() => {}),
      resendDeviceApproval: (email) => authService.resendDeviceApproval(email).then(() => {}),
      refreshSession,
      requestPasswordReset: (email) => authService.forgotPassword(email).then(() => {}),
      resetPassword: (t, p) => authService.resetPassword(t, p).then(() => {}),
      logout,
      switchToBuyer: () => setUser((p) => (p ? { ...p, activeRole: "buyer" } : p)),
      switchToSeller: () => {
        setUser((p) => (p ? { ...p, activeRole: "seller" } : p));
        return { ok: true, needsOnboarding: false };
      },
      toggleRole: () => {
        let role: UserRole = "buyer";
        setUser((p) => {
          if (!p) return p;
          role = (p.activeRole ?? "buyer") === "buyer" ? "seller" : "buyer";
          return { ...p, activeRole: role };
        });
        return { ok: true, needsOnboarding: false, role };
      },
    }),
    [
      user,
      status,
      loading,
      twoFactorChallenge,
      login,
      register,
      verifyTwoFactorLogin,
      refreshSession,
      logout,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
