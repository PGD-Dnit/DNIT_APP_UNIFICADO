// src/services/authService.ts
import { CONFIG } from "../core/config";

const AUTH_BASE = `${CONFIG.API_BASE}/auth`;

export type UserRole = "admin" | "editor" | "leitor";

export interface AuthUser {
  id: number;
  login: string;
  nome_completo: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginResult {
  user: AuthUser;
  token: string | null;
}

export class AuthApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

// Mantido apenas em memória volátil para complementar o cookie httpOnly sem expor o JWT a XSS via localStorage.
let memoryToken: string | null = null;

export function getStoredToken(): string | null {
  return memoryToken;
}

export function setStoredToken(token: string | null): void {
  memoryToken = token;
}

export function clearStoredToken(): void {
  memoryToken = null;
}

export function getAuthHeaders(): Record<string, string> {
  return memoryToken ? { Authorization: `Bearer ${memoryToken}` } : {};
}

export function normalizeAdLogin(rawLogin: string): string {
  const trimmed = rawLogin.trim();
  const withoutDomainPrefix = trimmed.includes("\\")
    ? trimmed.split("\\").pop() || trimmed
    : trimmed;
  const withoutEmailDomain = withoutDomainPrefix.replace(/@dnit\.gov\.br$/i, "");
  return withoutEmailDomain.trim().toLowerCase();
}

function normalizeRole(rawRole: unknown): UserRole {
  const r = String(rawRole || "leitor").trim().toLowerCase();
  if (r === "admin" || r === "administrador") return "admin";
  if (r === "editor") return "editor";
  return "leitor";
}

function extractAuthUser(data: unknown): AuthUser {
  const obj = data as Record<string, any> | null;
  const raw = obj?.usuario ?? obj?.user ?? obj?.dados ?? obj;
  if (!raw || (typeof raw.login !== "string" && typeof raw.usuario !== "string" && !raw.id)) {
    throw new Error("Resposta de autenticação inválida do servidor.");
  }

  return {
    id: Number(raw.id ?? raw.Id ?? raw.usuarioId ?? 0),
    login: String(raw.login ?? raw.usuario ?? raw.username ?? ""),
    nome_completo: String(
      raw.nome_completo ?? raw.nomeCompleto ?? raw.nome ?? raw.login ?? ""
    ),
    role: normalizeRole(raw.role ?? raw.perfil),
    iat: typeof raw.iat === "number" ? raw.iat : undefined,
    exp: typeof raw.exp === "number" ? raw.exp : undefined,
  };
}

async function parseResponse(r: Response): Promise<unknown> {
  const text = await r.text();
  let data: Record<string, any> | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // resposta não-JSON
  }

  if (!r.ok) {
    const msg =
      data?.erro ||
      data?.error ||
      data?.mensagem ||
      data?.message ||
      text.slice(0, 200) ||
      `Erro HTTP ${r.status}`;
    throw new AuthApiError(msg, r.status);
  }

  return data;
}

export const authService = {
  async login(rawLogin: string, senha: string): Promise<LoginResult> {
    const login = normalizeAdLogin(rawLogin);

    const r = await fetch(`${AUTH_BASE}/login`, {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ login, senha }),
    });

    const data = (await parseResponse(r)) as Record<string, any> | null;
    const token: string | null =
      typeof data?.token === "string"
        ? data.token
        : typeof data?.accessToken === "string"
        ? data.accessToken
        : null;

    if (token) {
      setStoredToken(token);
    }

    const user = extractAuthUser(data);
    return { user, token };
  },

  async me(): Promise<AuthUser> {
    const r = await fetch(`${AUTH_BASE}/me`, {
      method: "GET",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...getAuthHeaders(),
      },
    });

    try {
      const data = (await parseResponse(r)) as Record<string, any> | null;
      if (typeof data?.token === "string") {
        setStoredToken(data.token);
      }
      return extractAuthUser(data);
    } catch (err) {
      if (err instanceof AuthApiError && (err.status === 401 || err.status === 403)) {
        clearStoredToken();
      }
      throw err;
    }
  },

  async logout(): Promise<void> {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders(),
        },
      });
    } catch {
      // mesmo com falha de rede, limpa o estado local
    } finally {
      clearStoredToken();
    }
  },
};
