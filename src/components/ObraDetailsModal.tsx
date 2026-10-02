// src/components/ObraDetailsModal.tsx
import React, { useEffect, useState } from "react";
import { consultarObra } from "../services/obraService";
import type {
  ConsultaObraResponse,
  ObraRegistroBanco,
  ObraRegistroArcgis,
} from "../services/obraService";
import ObraFinancialChart from "./ObraFinancialChart";
import "./ObraDetailsModal.css";

interface Props {
  id: string; // Feature ID / Layer ID
  globalid: string; // Obra GlobalID
  onClose: () => void;
}

export const ObraDetailsModal: React.FC<Props> = ({ id, globalid, onClose }) => {
  const [data, setData] = useState<ConsultaObraResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  // Estado do tema do Modal (Respeita preferência do localStorage ou sistema)
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
    let cancelled = false;
    setLoading(true);
    setError(null);

    consultarObra(id, globalid)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("Erro ao consultar obra:", err);
          setError(err.message || "Falha ao carregar detalhes da obra.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, globalid]);

  // Tecla ESC fecha modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Formatadores de data e moeda
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

  // Registros do Banco e do ArcGIS
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
    <div className="obra-modal-overlay" data-theme={theme} onClick={onClose}>
      <div className="obra-modal-card" data-theme={theme} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="obra-modal-header">
          <div className="obra-header-title-group">
            <div className="obra-modal-badge-row">
              <span className={`obra-status-badge ${getStatusClass(status)}`}>
                <i className="fa-solid fa-circle" style={{ fontSize: 8 }} />
                {status}
              </span>
              <span className="obra-layer-title">{nomeCamada}</span>
            </div>
            <h2 className="obra-modal-title">{nomeObra}</h2>
          </div>
          <div className="obra-header-actions">
            <button
              className="obra-modal-theme-toggle"
              onClick={toggleTheme}
              title={`Alternar para modo ${theme === "dark" ? "Claro" : "Escuro"}`}
            >
              <i className={`fa-solid ${theme === "dark" ? "fa-sun" : "fa-moon"}`} />
              <span>{theme === "dark" ? "Claro" : "Escuro"}</span>
            </button>
            <button className="obra-modal-close-btn" onClick={onClose} title="Fechar (Esc)">
              &times;
            </button>
          </div>
        </div>

        {/* Body */}
        {loading ? (
          <div className="obra-modal-body">
            <div className="obra-modal-loading">
              <div className="obra-spinner" />
              <span>Consultando informações da obra no banco de dados…</span>
            </div>
          </div>
        ) : error ? (
          <div className="obra-modal-body">
            <div className="obra-modal-error">
              <i className="fa-solid fa-circle-exclamation obra-error-icon" />
              <span>{error}</span>
              <button className="obra-btn-primary" onClick={onClose}>
                Fechar
              </button>
            </div>
          </div>
        ) : (
          <div className="obra-modal-body">
            {/* Abas de Contratos — aparece só com 2+ contratos */}
            {registrosBanco.length > 1 && (
              <div className="obra-modal-tabs">
                {registrosBanco.map((reg, idx) => (
                  <button
                    key={reg.ContratoId ?? idx}
                    className={`obra-modal-tab-btn${activeTab === idx ? " active" : ""}`}
                    onClick={() => setActiveTab(idx)}
                  >
                    <i className="fa-solid fa-file-contract" />
                    <span>Contrato {idx + 1}</span>
                    <span className="obra-modal-tab-num">
                      {reg.NumeroContrato || `#${reg.ContratoId}`}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Seção 1: Dados do Contrato */}
            <div className="obra-section-card">
              <div className="obra-section-header">
                <i className="fa-solid fa-file-contract" />
                <span>Dados do Contrato</span>
              </div>
              <div className="obra-grid">
                <div className="obra-field">
                  <span className="obra-label">Número do Contrato</span>
                  <span className="obra-value highlight">{regBanco?.NumeroContrato || "N/A"}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Programa</span>
                  <span className="obra-value">{regBanco?.Programa || "N/A"}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Modalidade Licitação</span>
                  <span className="obra-value">{regBanco?.ModalidadeLicitacao || "N/A"}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">ID Contrato / Vínculo</span>
                  <span className="obra-value">
                    {regBanco?.ContratoId ? `#${regBanco.ContratoId}` : "N/A"}{" "}
                    {regBanco?.IdVinculoContrato ? `(Vínculo #${regBanco.IdVinculoContrato})` : ""}
                  </span>
                </div>
                <div className="obra-field obra-field-full">
                  <span className="obra-label">Objeto da Contratação</span>
                  <span className="obra-value">{regBanco?.ObjetoContratacao || "N/A"}</span>
                </div>
              </div>
            </div>

            {/* Seção 2: Valores Financeiros */}
            <div className="obra-section-card">
              <div className="obra-section-header">
                <i className="fa-solid fa-money-bill-wave" />
                <span>Valores Financeiros & Composição Orçamentária</span>
              </div>
              <div className="obra-grid">
                <div className="obra-field">
                  <span className="obra-label">Valor Inicial</span>
                  <span className="obra-value monetary">{formatCurrency(regBanco?.ValorInicial)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Valor Inicial + Aditivo</span>
                  <span className="obra-value monetary">{formatCurrency(regBanco?.ValorInicialAditivo)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Reajuste Total</span>
                  <span className="obra-value monetary">{formatCurrency(regBanco?.ValorTotalReajuste)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Valor Saldo</span>
                  <span className="obra-value monetary">{formatCurrency(regBanco?.ValorSaldo)}</span>
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

            {/* Seção 3: Datas & Prazos */}
            <div className="obra-section-card">
              <div className="obra-section-header">
                <i className="fa-solid fa-calendar-days" />
                <span>Vigência e Prazos</span>
              </div>
              <div className="obra-grid">
                <div className="obra-field">
                  <span className="obra-label">Data de Início</span>
                  <span className="obra-value">{formatDate(regBanco?.DataInicio)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Término Vigência</span>
                  <span className="obra-value">{formatDate(regBanco?.DataTerminoVigencia)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Término Atualizada</span>
                  <span className="obra-value">{formatDate(regBanco?.DataTerminoAtualizada)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Data de Carga / Vínculo</span>
                  <span className="obra-value">
                    {formatDate(regBanco?.DataCarga || regBanco?.DataVinculo)}
                  </span>
                </div>
              </div>
            </div>

            {/* Seção 4: Identificadores técnicos */}
            <div className="obra-section-card">
              <div className="obra-section-header">
                <i className="fa-solid fa-database" />
                <span>Identificadores Técnicos</span>
              </div>
              <div className="obra-grid">
                <div className="obra-field">
                  <span className="obra-label">GlobalID (DB / ArcGIS)</span>
                  <span className="obra-value code">
                    {data?.globalidFormatadoDB || data?.globalid || globalid}
                  </span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Feature ID</span>
                  <span className="obra-value code">{id}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">ObjectID</span>
                  <span className="obra-value">{regBanco?.ObjectId ?? regArcgis?.objectid ?? "N/A"}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Procedimento DB</span>
                  <span className="obra-value">{data?.banco?.procedure || "N/A"}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="obra-modal-footer">
          <span>
            DNIT • Sistema Unificado de Obras e GeoInteligência
          </span>
          <button className="obra-btn-primary" onClick={onClose}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};

export default ObraDetailsModal;
