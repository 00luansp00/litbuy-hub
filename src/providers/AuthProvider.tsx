import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { authMock, type AuthUser, type UserRole } from "@/services/authMock";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Papel ativo em memória (default "buyer"). Mock — nunca persistido. */
  activeRole: UserRole;
  hasSellerProfile: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (name: string, email: string, password: string) => Promise<AuthUser>;
  requestPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  switchToBuyer: () => void;
  switchToSeller: () => { ok: boolean; needsOnboarding: boolean };
  toggleRole: () => { ok: boolean; needsOnboarding: boolean; role: UserRole };
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => authMock.getSession().user);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authMock.login(email, password);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    setLoading(true);
    try {
      const u = await authMock.register(name, email, password);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestPasswordReset = useCallback(async (email: string) => {
    setLoading(true);
    try {
      await authMock.requestPasswordReset(email);
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await authMock.logout();
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const switchToBuyer = useCallback(() => {
    setUser((prev) => (prev ? { ...prev, activeRole: "buyer" } : prev));
  }, []);

  const switchToSeller = useCallback(() => {
    let needsOnboarding = false;
    setUser((prev) => {
      if (!prev) return prev;
      if (!prev.hasSellerProfile) {
        needsOnboarding = true;
        return prev;
      }
      return { ...prev, activeRole: "seller" };
    });
    return { ok: !needsOnboarding, needsOnboarding };
  }, []);

  const toggleRole = useCallback(() => {
    let needsOnboarding = false;
    let role: UserRole = "buyer";
    setUser((prev) => {
      if (!prev) return prev;
      const current = prev.activeRole ?? "buyer";
      if (current === "buyer") {
        if (!prev.hasSellerProfile) {
          needsOnboarding = true;
          role = "buyer";
          return prev;
        }
        role = "seller";
        return { ...prev, activeRole: "seller" };
      }
      role = "buyer";
      return { ...prev, activeRole: "buyer" };
    });
    return { ok: !needsOnboarding, needsOnboarding, role };
  }, []);

  const activeRole: UserRole = user?.activeRole ?? "buyer";
  const hasSellerProfile = !!user?.hasSellerProfile;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      activeRole,
      hasSellerProfile,
      login,
      register,
      requestPasswordReset,
      logout,
      switchToBuyer,
      switchToSeller,
      toggleRole,
    }),
    [
      user,
      loading,
      activeRole,
      hasSellerProfile,
      login,
      register,
      requestPasswordReset,
      logout,
      switchToBuyer,
      switchToSeller,
      toggleRole,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de <AuthProvider>");
  return ctx;
}
