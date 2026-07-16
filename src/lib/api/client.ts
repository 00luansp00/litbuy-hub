export type ApiErrorPayload = {
  statusCode?: number;
  code?: string;
  message?: string | string[];
  requestId?: string;
};

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  constructor(status: number, code: string, message: string, requestId?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
  }
}

function resolveApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (import.meta.env.DEV || import.meta.env.MODE === "test") return "http://localhost:3001/api/v1";
  throw new Error("VITE_API_BASE_URL deve ser definido em production.");
}
const API_BASE_URL = resolveApiBaseUrl();
const CSRF_COOKIE = "litbuy_csrf";
const CSRF_HEADER = "X-CSRF-Token";
let accessToken: string | null = null;
let refreshPromise: Promise<string> | null = null;
let onAuthLost: (() => void) | undefined;

const unsafe = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const noRefresh = [
  "/auth/login",
  "/auth/register",
  "/auth/password/forgot",
  "/auth/password/reset",
  "/auth/email/verify",
  "/auth/device/approve",
  "/auth/2fa/login/verify",
  "/auth/refresh",
];

export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}
export function setAuthLostHandler(handler: () => void) {
  onAuthLost = handler;
}

function readCsrfCookie(): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${CSRF_COOKIE}=`))
    ?.slice(CSRF_COOKIE.length + 1);
}

function decodeCsrfCookie(value: string | undefined): string | undefined {
  if (!value) return undefined;
  try {
    return decodeURIComponent(value);
  } catch {
    return undefined;
  }
}

function messageFromPayload(payload: ApiErrorPayload | null): string {
  if (!payload?.message) return "Não foi possível concluir a operação.";
  return Array.isArray(payload.message) ? payload.message.join(" ") : payload.message;
}

async function parseBody<T>(response: Response): Promise<T | undefined> {
  if (response.status === 204) return undefined;
  const text = await response.text();
  if (!text) return undefined;
  try {
    return JSON.parse(text) as T;
  } catch {
    return undefined;
  }
}

async function refreshAccessToken(): Promise<string> {
  if (!refreshPromise) {
    refreshPromise = apiFetch<{ accessToken: unknown }>("/auth/refresh", {
      method: "POST",
      skipAuthRefresh: true,
    })
      .then((data) => {
        if (typeof data.accessToken !== "string" || data.accessToken.trim().length === 0) {
          throw new ApiError(401, "INVALID_SESSION", "Sessão inválida.");
        }
        setAccessToken(data.accessToken);
        return data.accessToken;
      })
      .catch((error) => {
        setAccessToken(null);
        onAuthLost?.();
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }
  return refreshPromise;
}

export type ApiFetchOptions = RequestInit & { skipAuthRefresh?: boolean; auth?: boolean };

export async function apiFetch<T>(path: string, options: ApiFetchOptions = {}): Promise<T> {
  const method = (options.method ?? "GET").toUpperCase();
  const headers = new Headers(options.headers);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type"))
    headers.set("Content-Type", "application/json");
  if (accessToken && options.auth !== false) headers.set("Authorization", `Bearer ${accessToken}`);
  const csrf = decodeCsrfCookie(readCsrfCookie());
  if (csrf && unsafe.has(method)) headers.set(CSRF_HEADER, csrf);
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    method,
    headers,
    credentials: "include",
  });
  if (response.status === 401 && !options.skipAuthRefresh && !noRefresh.includes(path)) {
    try {
      await refreshAccessToken();
      return apiFetch<T>(path, { ...options, skipAuthRefresh: true });
    } catch {
      /* handled below */
    }
  }
  const parsed = await parseBody<T | ApiErrorPayload>(response);
  if (!response.ok) {
    const payload = parsed && typeof parsed === "object" ? (parsed as ApiErrorPayload) : null;
    const error = new ApiError(
      response.status,
      payload?.code ?? "HTTP_ERROR",
      messageFromPayload(payload),
      payload?.requestId,
    );
    throw error;
  }
  return parsed as T;
}
