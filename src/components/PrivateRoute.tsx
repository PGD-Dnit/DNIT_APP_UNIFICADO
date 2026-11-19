// src/components/PrivateRoute.tsx
import { useEffect } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import {
  useAuthStore,
  hasAllowedRole,
  formatRoleLabel,
} from "../core/authStore";
import type { UserRole } from "../services/authService";

interface PrivateRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
}

export default function PrivateRoute({
  children,
  allowedRoles,
}: PrivateRouteProps) {
  const location = useLocation();
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const initialized = useAuthStore((s) => s.initialized);
  const loading = useAuthStore((s) => s.loading);
  const checkAuth = useAuthStore((s) => s.checkAuth);

  useEffect(() => {
    if (!initialized) {
      checkAuth();
    }
  }, [initialized, checkAuth]);

  if (!initialized || (loading && !user)) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 12,
          background: "#0f172a",
          color: "#e2e8f0",
          fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
        }}
      >
        <i
          className="fa-solid fa-circle-notch fa-spin"
          style={{ fontSize: 28, color: "#38bdf8" }}
        />
        <span style={{ fontSize: 14, opacity: 0.85 }}>
          Verificando sessão corporativa...
        </span>
      </div>
    );
  }

  if (!user) {
    const from = `${location.pathname}${location.search}`;
    return <Navigate to="/login" state={{ from }} replace />;
  }

  if (!hasAllowedRole(user, allowedRoles)) {
    return (
      <div
        style={{
          position: "fixed",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 24,
          background: "#0f172a",
          color: "#f8fafc",
          fontFamily: '"Inter", "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            background: "#1e293b",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 14,
            padding: "28px 24px",
            textAlign: "center",
          }}
        >
          <i
            className="fa-solid fa-lock"
            style={{ fontSize: 32, color: "#f59e0b", marginBottom: 12 }}
          />
          <h2 style={{ margin: "0 0 8px", fontSize: 19 }}>Acesso Restrito</h2>
          <p
            style={{
              margin: "0 0 20px",
              fontSize: 14,
              color: "#94a3b8",
              lineHeight: 1.5,
            }}
          >
            Seu perfil atual (<strong>{formatRoleLabel(user.role)}</strong>) não
            possui permissão para acessar esta funcionalidade.
          </p>
          <button
            type="button"
            onClick={() => navigate("/")}
            style={{
              height: 40,
              padding: "0 20px",
              borderRadius: 8,
              border: 0,
              background: "#1976d2",
              color: "#fff",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Voltar ao Mapa
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

