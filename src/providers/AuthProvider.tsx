import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const pendingCountRef = useRef(0);
  const mountedRef = useRef(false);
  const resendTwoFactorPromiseRef = useRef<Promise<void> | null>(null);

  const setSafeLoading = useCallback((next: boolean) => {
    if (mountedRef.current) setLoading(next);
  }, []);

  const runPending = useCallback(
    async <T,>(operation: () => Promise<T>) => {
      pendingCountRef.current += 1;
      setSafeLoading(true);
      try {
        return await operation();
      } finally {
        pendingCountRef.current = Math.max(0, pendingCountRef.current - 1);
        if (pendingCountRef.current === 0) setSafeLoading(false);
      }
    },
    [setSafeLoading],
  );

  const clear = useCallback(() => {
    setAccessToken(null);
    setUser(null);
    setStatus("anonymous");
    setTwoFactorChallenge(null);
    queryClient.removeQueries({ predicate: (q) => q.queryKey[0] !== "public" });
  }, [queryClient]);

  const applyAuthenticatedUser = useCallback(
    (fresh: AuthMe) => {
      const next = withPresentation(fresh);
      setUser(next);
      setStatus("authenticated");
      setTwoFactorChallenge(null);
      queryClient.removeQueries();
      return next;
    },
    [queryClient],
  );

  const applySuccess = useCallback(
    async (result: AuthSuccess) => {
      if (!isAuthSuccess(result)) {
        clear();
        throw new Error("Resposta de autenticação inválida.");
      }
      setAccessToken(result.accessToken);
      try {
        const fresh = await authService.me();
        return applyAuthenticatedUser(fresh);
      } catch (error) {
        clear();
        throw error;
      }
    },
    [applyAuthenticatedUser, clear],
  );

  useEffect(() => {
    mountedRef.current = true;
    setAuthLostHandler(clear);
    if (typeof window === "undefined") {
      return () => {
        mountedRef.current = false;
        setAuthLostHandler(() => {});
      };
    }
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
      mountedRef.current = false;
      setAuthLostHandler(() => {});
    };
  }, [clear]);

  const login = useCallback(
    async (email: string, password: string): Promise<LoginResult> => {
      setSafeLoading(true);
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
        setSafeLoading(false);
      }
    },
    [applySuccess, clear, setSafeLoading],
  );

  const register = useCallback(
    async (payload: RegisterPayload) =>
      runPending(async () => {
        await authService.register(payload);
        setStatus("emailVerificationRequired");
      }),
    [runPending],
  );

  const verifyTwoFactorLogin = useCallback(
    async (payload: { code?: string; recoveryCode?: string }) => {
      if (!twoFactorChallenge?.challengeId) throw new Error("2FA challenge ausente");
      return runPending(() =>
        authService
          .verifyTwoFactorLogin({
            challengeId: twoFactorChallenge.challengeId,
            ...payload,
          })
          .then(applySuccess),
      );
    },
    [applySuccess, runPending, twoFactorChallenge],
  );

  const logout = useCallback(async () => {
    setSafeLoading(true);
    try {
      await authService.logout();
    } catch {
      // Logout local precisa limpar estado mesmo com API indisponível.
    } finally {
      clear();
      setSafeLoading(false);
    }
  }, [clear, setSafeLoading]);

  const refreshSession = useCallback(
    () =>
      runPending(async () => {
        const r = await authService.refresh();
        if (!r.accessToken || typeof r.accessToken !== "string") {
          clear();
          throw new Error("Sessão inválida.");
        }
        setAccessToken(r.accessToken);
        try {
          applyAuthenticatedUser(await authService.me());
        } catch (error) {
          clear();
          throw error;
        }
      }),
    [applyAuthenticatedUser, clear, runPending],
  );

  const verifyEmail = useCallback(
    (token: string) => runPending(() => authService.verifyEmail(token).then(() => {})),
    [runPending],
  );
  const approveDevice = useCallback(
    (token: string) => runPending(() => authService.approveDevice(token).then(() => {})),
    [runPending],
  );
  const resendEmailVerification = useCallback(
    (email: string) => runPending(() => authService.resendEmailVerification(email).then(() => {})),
    [runPending],
  );
  const resendDeviceApproval = useCallback(
    (email: string) => runPending(() => authService.resendDeviceApproval(email).then(() => {})),
    [runPending],
  );
  const requestPasswordReset = useCallback(
    (email: string) => runPending(() => authService.forgotPassword(email).then(() => {})),
    [runPending],
  );
  const resetPassword = useCallback(
    (token: string, password: string) =>
      runPending(() => authService.resetPassword(token, password).then(() => {})),
    [runPending],
  );
  const resendTwoFactorLogin = useCallback(() => {
    if (!twoFactorChallenge?.challengeId) return Promise.reject(new Error("2FA challenge ausente"));
    if (resendTwoFactorPromiseRef.current) return resendTwoFactorPromiseRef.current;
    const challenge = twoFactorChallenge;
    const promise = runPending(() =>
      authService.resendTwoFactorLogin(challenge.challengeId).then((r) => {
        setTwoFactorChallenge((current) =>
          current?.challengeId === challenge.challengeId ? { ...current, ...r } : current,
        );
      }),
    ).finally(() => {
      resendTwoFactorPromiseRef.current = null;
    });
    resendTwoFactorPromiseRef.current = promise;
    return promise;
  }, [runPending, twoFactorChallenge]);

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
      verifyEmail,
      approveDevice,
      verifyTwoFactorLogin,
      resendTwoFactorLogin,
      resendEmailVerification,
      resendDeviceApproval,
      refreshSession,
      requestPasswordReset,
      resetPassword,
      logout,
      clearAuthentication: clear,
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
      clear,
      verifyEmail,
      approveDevice,
      resendTwoFactorLogin,
      resendEmailVerification,
      resendDeviceApproval,
      requestPasswordReset,
      resetPassword,
    ],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
