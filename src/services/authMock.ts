/**
 * Mock de autenticação — 100% em memória.
 * Nenhum LocalStorage, cookie, JWT ou backend envolvido.
 * A assinatura pública imita o que será um AuthService real no futuro.
 *
 * A partir do ajuste arquitetural pós-Sprint 14, o mesmo usuário pode
 * atuar como comprador e vendedor na mesma conta. Os campos
 * hasSellerProfile / sellerSlug / sellerName / activeRole são 100% mockados
 * e existem apenas para preparar UI (UserMenu, CTAs, dashboards) para o
 * duplo papel — nenhum backend implementa isso ainda.
 */

export type UserRole = "buyer" | "seller";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
  /** Se o usuário já criou perfil de vendedor. Mock. */
  hasSellerProfile?: boolean;
  /** Slug público da loja do vendedor (usado em /loja/$slug). Mock. */
  sellerSlug?: string;
  /** Nome público da loja do vendedor. Mock. */
  sellerName?: string;
  /** Papel ativo na sessão em memória. Default "buyer". */
  activeRole?: UserRole;
  /**
   * Marca visual/mockada de acesso administrativo. Habilitada para
   * demonstrar o Painel Administrativo — NÃO representa RBAC real.
   * Permissões reais devem ser resolvidas no backend.
   */
  isAdmin?: boolean;
}

export interface AuthSession {
  user: AuthUser | null;
  isAuthenticated: boolean;
}

let currentUser: AuthUser | null = null;

const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function nameFromEmail(email: string): string {
  const raw = email.split("@")[0] ?? "Usuário";
  return raw
    .replace(/[._-]+/g, " ")
    .split(" ")
    .filter(Boolean)
    .map((s) => s[0]!.toUpperCase() + s.slice(1))
    .join(" ");
}

function buildMockUser(name: string, email: string): AuthUser {
  return {
    id: "mock-user",
    name,
    email,
    // Mock: todo usuário logado já tem perfil de vendedor demo,
    // apontando para a loja "novakeys" (sellers.nova) para permitir
    // navegar para /loja/$slug. Trocar no futuro por dados reais.
    hasSellerProfile: true,
    sellerSlug: "novakeys",
    sellerName: "NovaKeys Store",
    activeRole: "buyer",
    // Mock/demo: usuário logado tem acesso ao painel administrativo
    // apenas visualmente. Nenhuma permissão real é aplicada.
    isAdmin: true,
  };
}

export const authMock = {
  getSession(): AuthSession {
    return { user: currentUser, isAuthenticated: !!currentUser };
  },

  async login(email: string, _password: string): Promise<AuthUser> {
    await wait(600);
    currentUser = buildMockUser(nameFromEmail(email), email);
    return currentUser;
  },

  async register(name: string, email: string, _password: string): Promise<AuthUser> {
    await wait(700);
    currentUser = buildMockUser(name.trim() || nameFromEmail(email), email);
    return currentUser;
  },

  async requestPasswordReset(_email: string): Promise<void> {
    await wait(600);
  },

  async logout(): Promise<void> {
    await wait(200);
    currentUser = null;
  },
};
