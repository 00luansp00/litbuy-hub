/**
 * Mock de autenticação — 100% em memória.
 * Nenhum LocalStorage, cookie, JWT ou backend envolvido.
 * A assinatura pública imita o que será um AuthService real no futuro.
 */

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string;
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

export const authMock = {
  getSession(): AuthSession {
    return { user: currentUser, isAuthenticated: !!currentUser };
  },

  async login(email: string, _password: string): Promise<AuthUser> {
    await wait(600);
    currentUser = {
      id: "mock-user",
      name: nameFromEmail(email),
      email,
    };
    return currentUser;
  },

  async register(name: string, email: string, _password: string): Promise<AuthUser> {
    await wait(700);
    currentUser = {
      id: "mock-user",
      name: name.trim() || nameFromEmail(email),
      email,
    };
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
