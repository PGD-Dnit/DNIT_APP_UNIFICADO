// src/pages/ObraDetailsPage.tsx
import React, { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { consultarObra } from "../services/obraService";
import type {
  ConsultaObraResponse,
  ObraRegistroBanco,
  ObraRegistroArcgis,
} from "../services/obraService";
import ObraFinancialChart from "../components/ObraFinancialChart";
import "./ObraDetailsPage.css";

export default function ObraDetailsPage() {
  const [searchParams] = useSearchParams();
  const id = searchParams.get("id") || "";
  const globalid = searchParams.get("globalid") || "";

  const [data, setData] = useState<ConsultaObraResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Estado do tema (Salva no localStorage ou pega preferência do sistema)
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    const saved = localStorage.getItem("dnit_theme");
    if (saved === "light" || saved === "dark") return saved;
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  });

  const toggleTheme = () => {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
    localStorage.setItem("dnit_theme", nextTheme);
  };

  useEffect(() => {
    if (!id || !globalid) {
      setError("Parâmetros 'id' ou 'globalid' ausentes na URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    console.log(
      `%c[ObraDetailsPage] 🔍 Buscando dados da obra...\n ➔ ID Feature: ${id}\n ➔ GlobalID: ${globalid}`,
      "color: #4ade80; font-weight: bold; font-size: 13px;"
    );

    consultarObra(id, globalid)
      .then((res) => {
        if (!cancelled) {
          console.log("%c[ObraDetailsPage] 📦 Resposta recebida do backend:", "color: #38bdf8; font-weight: bold;", res);
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Erro ao consultar obra:", err);
          setError(err.message || "Falha ao carregar os dados da obra.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, globalid]);

  const formatDate = (dateStr?: string | null) => {
    if (!dateStr) return "N/A";
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return dateStr;
      return date.toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const formatCurrency = (val?: number | null) => {
    if (val == null) return "R$ 0,00";
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(val);
  };

  // Todos os registros do banco (um por contrato)
  const registrosBanco: ObraRegistroBanco[] = data?.banco?.registros ?? [];
  const regBanco: ObraRegistroBanco | null = registrosBanco[activeTab] ?? registrosBanco[0] ?? null;
  const regArcgis: ObraRegistroArcgis | null = data?.arcgis?.camadas?.[0]?.registros?.[0] ?? null;
  const nomeCamada = data?.arcgis?.camadas?.[0]?.title ?? regBanco?.NomeCamada ?? "Obra";

  const nomeObra = regBanco?.NomeObra || regArcgis?.nome_obra || "Detalhes da Obra";
  const status = regBanco?.Status || regArcgis?.status || "N/A";

  const getStatusClass = (statusStr: string) => {
    const low = statusStr.toLowerCase();
    if (low.includes("finaliza")) return "finalizada";
    if (low.includes("andamento")) return "em_andamento";
    if (low.includes("emergên") || low.includes("paralis")) return "emergencial";
    return "";
  };

  return (
    <div className="obra-page-container" data-theme={theme}>
      {/* Top Navbar */}
      <header className="obra-page-navbar">
        <div className="obra-brand-group">
          <div className="obra-brand-logo">
            <i className="fa-solid fa-helmet-safety" />
          </div>
          <span className="obra-brand-title">DNIT • Consulta de Obras</span>
          <span className="obra-brand-subtitle">Acompanhamento e GeoInteligência</span>
        </div>

        {/* Botão de Alternância de Tema */}
        <button
          className="obra-theme-toggle"
          onClick={toggleTheme}
          title={`Alternar para modo ${theme === "dark" ? "Claro" : "Escuro"}`}
        >
          <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} />
          <span>{theme === "dark" ? "Modo Claro" : "Modo Escuro"}</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="obra-page-main">
        {loading ? (
          <div className="obra-state-container">
            <div className="obra-page-spinner" />
            <p style={{ color: "#94a3b8" }}>Carregando dados completos da obra...</p>
          </div>
        ) : error ? (
          <div className="obra-state-container">
            <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: 48, color: "#f87171" }} />
            <h2>Ops! Algo deu errado</h2>
            <p style={{ color: "#94a3b8" }}>{error}</p>
          </div>
        ) : (
          <>
            {/* Hero Banner */}
            <div className="obra-hero-card">
              <div className="obra-hero-header">
                <div className="obra-title-area">
                  <div className="obra-hero-badges">
                    <span className={`obra-status-pill ${getStatusClass(status)}`}>
                      <i className="fa-solid fa-circle" style={{ fontSize: 7 }} />
                      {status}
                    </span>
                    <span className="obra-layer-tag">{nomeCamada}</span>
                  </div>
                  <h1 className="obra-main-title">{nomeObra}</h1>
                  <p className="obra-main-subtitle">
                    {regBanco?.ObjetoContratacao || "Sem especificação cadastrada."}
                  </p>
                </div>
              </div>
            </div>

            {/* Abas de Contratos */}
            {registrosBanco.length > 1 && (
              <div className="obra-tabs-container">
                {registrosBanco.map((reg, idx) => (
                  <button
                    key={reg.ContratoId ?? idx}
                    className={`obra-tab-btn${activeTab === idx ? " active" : ""}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    <i className="fa-solid fa-file-contract" />
                    <span>Contrato {idx + 1}</span>
                    <span className="obra-tab-numero">{reg.NumeroContrato || `#${reg.ContratoId}`}</span>
                  </button>
                ))}
              </div>
            )}

            {/* Grid de Informações */}
            <div className="obra-details-grid">
              {/* Card 1: Contrato & Licitação */}
              <div className="obra-card">
                <div className="obra-card-header">
                  <i className="fa-solid fa-file-contract" />
                  <span>Contrato e Licitação</span>
                </div>
                <div className="obra-fields-grid">
                  <div className="obra-field-item">
                    <span className="obra-item-label">Número do Contrato</span>
                    <span className="obra-item-value highlight-blue">
                      {regBanco?.NumeroContrato || "N/A"}
                    </span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Programa</span>
                    <span className="obra-item-value">{regBanco?.Programa || "N/A"}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Modalidade Licitação</span>
                    <span className="obra-item-value">{regBanco?.ModalidadeLicitacao || "N/A"}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">ID Contrato / Vínculo</span>
                    <span className="obra-item-value">
                      {regBanco?.ContratoId ? `#${regBanco.ContratoId}` : "N/A"}{" "}
                      {regBanco?.IdVinculoContrato ? `(Vínculo #${regBanco.IdVinculoContrato})` : ""}
                    </span>
                  </div>
                  <div className="obra-field-item full-width">
                    <span className="obra-item-label">Objeto da Contratação</span>
                    <span className="obra-item-value">{regBanco?.ObjetoContratacao || "N/A"}</span>
                  </div>
                </div>
              </div>

              {/* Card 2: Valores Financeiros */}
              <div className="obra-card" style={{ gridColumn: "1 / -1" }}>
                <div className="obra-card-header">
                  <i className="fa-solid fa-coins" />
                  <span>Valores Financeiros & Composição Orçamentária</span>
                </div>
                <div className="obra-fields-grid">
                  <div className="obra-field-item">
                    <span className="obra-item-label">Valor Inicial</span>
                    <span className="obra-item-value monetary-val">
                      {formatCurrency(regBanco?.ValorInicial)}
                    </span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Valor Inicial + Aditivo</span>
                    <span className="obra-item-value monetary-val">
                      {formatCurrency(regBanco?.ValorInicialAditivo)}
                    </span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Total Reajuste</span>
                    <span className="obra-item-value monetary-val">
                      {formatCurrency(regBanco?.ValorTotalReajuste)}
                    </span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Saldo Restante</span>
                    <span className="obra-item-value monetary-val">
                      {formatCurrency(regBanco?.ValorSaldo)}
                    </span>
                  </div>
                </div>

                {/* Gráfico Donut + Barra de Progresso */}
                <ObraFinancialChart
                  valorInicial={regBanco?.ValorInicial}
                  valorInicialAditivo={regBanco?.ValorInicialAditivo}
                  valorTotalReajuste={regBanco?.ValorTotalReajuste}
                  valorSaldo={regBanco?.ValorSaldo}
                />
              </div>

              {/* Card 3: Prazos e Vigência */}
              <div className="obra-card">
                <div className="obra-card-header">
                  <i className="fa-solid fa-calendar-check" />
                  <span>Vigência e Cronograma</span>
                </div>
                <div className="obra-fields-grid">
                  <div className="obra-field-item">
                    <span className="obra-item-label">Data de Início</span>
                    <span className="obra-item-value">{formatDate(regBanco?.DataInicio)}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Término Vigência</span>
                    <span className="obra-item-value">{formatDate(regBanco?.DataTerminoVigencia)}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Término Atualizada</span>
                    <span className="obra-item-value">{formatDate(regBanco?.DataTerminoAtualizada)}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">Data de Carga / Vínculo</span>
                    <span className="obra-item-value">
                      {formatDate(regBanco?.DataCarga || regBanco?.DataVinculo)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Card 4: Identificadores Técnicos */}
              <div className="obra-card">
                <div className="obra-card-header">
                  <i className="fa-solid fa-server" />
                  <span>Dados Técnicos do ArcGIS & DB</span>
                </div>
                <div className="obra-fields-grid">
                  <div className="obra-field-item full-width">
                    <span className="obra-item-label">GlobalID</span>
                    <span className="obra-item-value code-box">
                      {data?.globalidFormatadoDB || data?.globalid || globalid}
                    </span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">ID Feature</span>
                    <span className="obra-item-value code-box">{id}</span>
                  </div>
                  <div className="obra-field-item">
                    <span className="obra-item-label">ObjectID</span>
                    <span className="obra-item-value">{regBanco?.ObjectId ?? regArcgis?.objectid ?? "N/A"}</span>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
