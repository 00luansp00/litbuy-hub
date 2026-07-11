import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { authMock, type AuthUser, type UserRole } from "@/services/authMock";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  /** Papel ativo em memória (default "buyer"). Mock — nunca persistido. */
  activeRole: UserRole;
  hasSellerProfile: boolean;
  /** Acesso administrativo mockado — nunca substitui RBAC real. */
  isAdmin: boolean;
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
    // Toda conta comum é compradora e vendedora por padrão.
    // Alternar para "seller" é apenas contexto visual, sem bloqueio.
    setUser((prev) => (prev ? { ...prev, activeRole: "seller" } : prev));
    return { ok: true, needsOnboarding: false };
  }, []);

  const toggleRole = useCallback(() => {
    let role: UserRole = "buyer";
    setUser((prev) => {
      if (!prev) return prev;
      const next: UserRole = (prev.activeRole ?? "buyer") === "buyer" ? "seller" : "buyer";
      role = next;
      return { ...prev, activeRole: next };
    });
    return { ok: true, needsOnboarding: false, role };
  }, []);


  const activeRole: UserRole = user?.activeRole ?? "buyer";
  const hasSellerProfile = !!user?.hasSellerProfile;
  const isAdmin = !!user?.isAdmin;

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      loading,
      activeRole,
      hasSellerProfile,
      isAdmin,
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
      isAdmin,
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
