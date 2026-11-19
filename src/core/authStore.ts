// src/core/authStore.ts
import { create } from "zustand";
import {
  authService,
  AuthApiError,
  clearStoredToken,
  type AuthUser,
  type UserRole,
} from "../services/authService";

interface AuthState {
  user: AuthUser | null;
  loading: boolean;
  initialized: boolean;
  error: string | null;

  signIn: (login: string, senha: string) => Promise<AuthUser>;
  signOut: () => Promise<void>;
  checkAuth: (opts?: { force?: boolean }) => Promise<AuthUser | null>;
  clearError: () => void;
  handleUnauthorized: (msg?: string) => void;
}

let inFlightCheck: Promise<AuthUser | null> | null = null;

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: false,
  initialized: false,
  error: null,

  clearError: () => set({ error: null }),

  handleUnauthorized: (msg) => {
    clearStoredToken();
    set({
      user: null,
      loading: false,
      initialized: true,
      error: msg || null,
    });
  },

  signIn: async (login: string, senha: string) => {
    set({ loading: true, error: null });
    try {
      const { user } = await authService.login(login, senha);
      set({
        user,
        loading: false,
        initialized: true,
        error: null,
      });
      return user;
    } catch (err: any) {
      const message =
        err?.message || "Não foi possível autenticar. Verifique suas credenciais do AD.";
      set({
        user: null,
        loading: false,
        error: message,
      });
      throw err;
    }
  },

  signOut: async () => {
    set({ loading: true });
    try {
      await authService.logout();
    } finally {
      set({
        user: null,
        loading: false,
        initialized: true,
        error: null,
      });
    }
  },

  checkAuth: async (opts) => {
    const force = !!opts?.force;
    const state = get();

    if (!force && state.initialized && !inFlightCheck) {
      return state.user;
    }

    if (inFlightCheck) {
      return inFlightCheck;
    }

    set({ loading: true });

    inFlightCheck = (async () => {
      try {
        const user = await authService.me();
        set({
          user,
          loading: false,
          initialized: true,
          error: null,
        });
        return user;
      } catch (err: any) {
        // Se foi 403 (ex: usuário desativado ativo=0 no banco), preserva a mensagem para exibir no login
        const forbiddenMsg =
          err instanceof AuthApiError && err.status === 403 ? err.message : null;
        set({
          user: null,
          loading: false,
          initialized: true,
          error: forbiddenMsg,
        });
        return null;
      } finally {
        inFlightCheck = null;
      }
    })();

    return inFlightCheck;
  },
}));

// Helpers de Perfil (Role)
export function canUserEdit(user: AuthUser | null | undefined): boolean {
  if (!user) return false;
  return user.role === "admin" || user.role === "editor";
}

export function isUserAdmin(user: AuthUser | null | undefined): boolean {
  return user?.role === "admin";
}

export function hasAllowedRole(
  user: AuthUser | null | undefined,
  allowedRoles?: UserRole[]
): boolean {
  if (!user) return false;
  if (!allowedRoles || allowedRoles.length === 0) return true;
  return allowedRoles.includes(user.role);
}

export function formatRoleLabel(role?: UserRole): string {
  switch (role) {
    case "admin":
      return "Administrador";
    case "editor":
      return "Editor";
    case "leitor":
      return "Leitor";
    default:
      return "Leitor";
  }
}

