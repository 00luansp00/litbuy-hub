import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ApiError, setAccessToken, setAuthLostHandler } from "@/lib/api/client";
import { AuthContext, type AuthContextValue } from "@/providers/AuthContext";
import {
  authService,
  toDisplayUser,
  type AuthMe,
  type AuthSuccess,
  type AuthUser,
  type LoginPayload,
  type LoginResponse,
  type LoginResult,
  type RegisterPayload,
  type UserRole,
} from "@/services/auth";

const demoRoles =
  import.meta.env.MODE !== "production" && import.meta.env.VITE_ENABLE_DEMO_ROLES === "true";
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function withPresentation(u: AuthMe, activeRole: UserRole = "buyer"): AuthUser {
  return { ...toDisplayUser(u), activeRole };
}

function isAuthSuccess(response: LoginResponse | AuthSuccess): response is AuthSuccess {
  return (
    "accessToken" in response &&
    typeof response.accessToken === "string" &&
    response.accessToken.trim().length > 0
  );
}

function parseLoginChallenge(response: LoginResponse): LoginResult | null {
  if ("code" in response && response.code === "DEVICE_APPROVAL_REQUIRED") {
    return { status: "deviceApprovalRequired" };
  }
  if ("code" in response && response.code === "TWO_FACTOR_REQUIRED") {
    if (
      !uuidV4.test(response.challengeId) ||
      (response.method !== "EMAIL" && response.method !== "SMS") ||
      Number.isNaN(Date.parse(response.expiresAt))
    ) {
      throw new Error("Challenge de 2FA malformado.");
    }
    return {
      status: "twoFactorRequired",
      challengeId: response.challengeId,
      method: response.method,
      expiresAt: response.expiresAt,
    };
  }
  return null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthContextValue["status"]>("initializing");
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
      if (!isAuthSuccess(result)) {
        clear();
        throw new Error("Resposta de autenticação inválida.");
      }
      setAccessToken(result.accessToken);
      try {
        const fresh = await authService.me();
        const next = withPresentation(fresh);
        setUser(next);
        setStatus("authenticated");
        setTwoFactorChallenge(null);
        queryClient.removeQueries();
        return next;
      } catch (error) {
        clear();
        throw error;
      }
    },
    [clear, queryClient],
  );

  useEffect(() => {
    setAuthLostHandler(clear);
    if (typeof window === "undefined") return;
    let cancelled = false;
    authService
      .refresh()
      .then(({ accessToken }) => {
        if (cancelled) return undefined;
        if (!accessToken || typeof accessToken !== "string") throw new Error("Sessão inválida.");
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
          deviceName: typeof navigator !== "undefined" ? navigator.platform : "Navegador",
        } as LoginPayload);
        if (isAuthSuccess(result)) {
          const next = await applySuccess(result);
          return { status: "authenticated", user: next };
        }
        const challenge = parseLoginChallenge(result);
        if (challenge?.status === "deviceApprovalRequired") {
          setUser(null);
          setAccessToken(null);
          setTwoFactorChallenge(null);
          setStatus("deviceApprovalRequired");
          return challenge;
        }
        if (challenge?.status === "twoFactorRequired") {
          setUser(null);
          setAccessToken(null);
          setTwoFactorChallenge(challenge);
          setStatus("twoFactorRequired");
          return challenge;
        }
        clear();
        throw new Error("Resposta de login desconhecida.");
      } catch (e) {
        if (e instanceof ApiError && e.code === "EMAIL_NOT_VERIFIED") {
          setUser(null);
          setAccessToken(null);
          setStatus("emailVerificationRequired");
          return { status: "emailVerificationRequired" };
        }
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [applySuccess, clear],
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
        return await applySuccess(
          await authService.verifyTwoFactorLogin({
            challengeId: twoFactorChallenge.challengeId,
            ...payload,
          }),
        );
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
    } catch {
      // Logout local precisa limpar estado mesmo com API indisponível.
    } finally {
      clear();
      setLoading(false);
    }
  }, [clear]);

  const refreshSession = useCallback(async () => {
    const r = await authService.refresh();
    await applySuccess({ accessToken: r.accessToken, user: await authService.me() });
  }, [applySuccess]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: status === "authenticated" && !!user,
      initializing: status === "initializing",
      loading,
      status,
      activeRole: user?.activeRole ?? "buyer",
      hasSellerProfile: demoRoles && !!user,
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
        // Apenas contexto visual: não representa perfil de vendedor real nem autorização.
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
