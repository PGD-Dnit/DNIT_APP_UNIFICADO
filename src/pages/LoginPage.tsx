// src/pages/LoginPage.tsx
import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuthStore } from "../core/authStore";
import "./LoginPage.css";

export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const initialized = useAuthStore((s) => s.initialized);
  const error = useAuthStore((s) => s.error);
  const signIn = useAuthStore((s) => s.signIn);
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const clearError = useAuthStore((s) => s.clearError);

  const [login, setLogin] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erroLocal, setErroLocal] = useState<string | null>(null);

  const rawDestino = (location.state as { from?: string } | null)?.from;
  const destino =
    typeof rawDestino === "string" && rawDestino.startsWith("/") && !rawDestino.startsWith("//")
      ? rawDestino
      : "/";

  useEffect(() => {
    if (!initialized) {
      checkAuth();
    }
  }, [initialized, checkAuth]);

  useEffect(() => {
    if (initialized && user) {
      navigate(destino, { replace: true });
    }
  }, [initialized, user, navigate, destino]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setErroLocal(null);
    clearError();

    if (!login.trim()) {
      setErroLocal("Informe seu usuário de rede (Active Directory).");
      return;
    }
    if (!senha) {
      setErroLocal("Informe sua senha de rede.");
      return;
    }

    try {
      await signIn(login, senha);
      navigate(destino, { replace: true });
    } catch {
      /* erro já preenchido no useAuthStore */
    }
  };

  const msgErro = erroLocal || error;

  return (
    <div className="login-page">
      <div className="login-bg-grid" aria-hidden="true" />

      <div className="login-shell">
        <main className="login-card" aria-labelledby="tituloLogin">
          <header className="login-header">
            <span className="login-brand-pill">
              <i className="fa-solid fa-shield-halved" />
              Active Directory · DNIT
            </span>

            <div className="login-logo-row">
              <div className="login-logo-icon" aria-hidden="true">
                <i className="fa-solid fa-earth-americas" />
              </div>
              <h1 id="tituloLogin" className="login-title">
                obras<span>360</span>
              </h1>
            </div>

            <p className="login-subtitle">
              Entre com suas credenciais corporativas de rede do DNIT para acessar a
              plataforma unificada de obras e contratos.
            </p>
          </header>

          {msgErro && (
            <div className="login-alert" role="alert">
              <i className="fa-solid fa-circle-exclamation" />
              <span>{msgErro}</span>
            </div>
          )}

          <form className="login-form" onSubmit={handleSubmit} noValidate>
            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="inputLoginAd">Usuário AD</label>
                <span className="login-field-hint">nome.sobrenome</span>
              </div>
              <div className="login-input-wrap">
                <i className="fa-solid fa-user login-input-icon" aria-hidden="true" />
                <input
                  id="inputLoginAd"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  placeholder="Ex: clayton.araujo"
                  value={login}
                  disabled={loading}
                  onChange={(e) => {
                    setLogin(e.target.value);
                    if (erroLocal) setErroLocal(null);
                  }}
                />
              </div>
            </div>

            <div className="login-field">
              <div className="login-label-row">
                <label htmlFor="inputSenhaAd">Senha de Rede</label>
              </div>
              <div className="login-input-wrap">
                <i className="fa-solid fa-lock login-input-icon" aria-hidden="true" />
                <input
                  id="inputSenhaAd"
                  type={mostrarSenha ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Digite sua senha do AD"
                  value={senha}
                  disabled={loading}
                  onChange={(e) => {
                    setSenha(e.target.value);
                    if (erroLocal) setErroLocal(null);
                  }}
                />
                <button
                  type="button"
                  className="login-toggle-pwd"
                  onClick={() => setMostrarSenha((v) => !v)}
                  title={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
                  tabIndex={-1}
                >
                  <i
                    className={`fa-regular ${mostrarSenha ? "fa-eye-slash" : "fa-eye"
                      }`}
                  />
                </button>
              </div>
            </div>

            <button
              type="submit"
              id="btnEntrarAd"
              className="login-submit-btn"
              disabled={loading}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" />
                  Autenticando no AD...
                </>
              ) : (
                <>
                  <i className="fa-solid fa-right-to-bracket" />
                  Entrar
                </>
              )}
            </button>
          </form>

          <footer className="login-footer-info">
            <i className="fa-solid fa-key" aria-hidden="true" />
            <span>
              Sessão segura de 8h gerenciada via Active Directory e controle de perfil
              (Admin, Editor, Leitor).
            </span>
          </footer>
        </main>

        <div className="login-copyright">
          DNIT · Departamento Nacional de Infraestrutura de Transportes
        </div>
      </div>
    </div>
  );
}

