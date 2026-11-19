// src/components/ObraDetailsModal.tsx
import React, { useEffect } from "react";
import ObraFinancialChart from "./ObraFinancialChart";
import { useThemePreference } from "../hooks/useThemePreference";
import { useObraDetails, getObraStatusClass } from "../hooks/useObraDetails";
import { formatDatePtBr, formatCurrencyBrl } from "../utils/formatters";
import "./ObraDetailsModal.css";

interface Props {
  id: string;
  globalid: string;
  onClose: () => void;
}

export const ObraDetailsModal: React.FC<Props> = ({ id, globalid, onClose }) => {
  const [theme, toggleTheme] = useThemePreference();
  const {
    data,
    loading,
    error,
    activeTab,
    setActiveTab,
    registrosBanco,
    regBanco,
    regArcgis,
    nomeCamada,
    nomeObra,
    status,
  } = useObraDetails(id, globalid);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <div className="obra-modal-overlay" data-theme={theme} onClick={onClose}>
      <div className="obra-modal-card" data-theme={theme} onClick={(e) => e.stopPropagation()}>
        <div className="obra-modal-header">
          <div className="obra-header-title-group">
            <div className="obra-modal-badge-row">
              <span className={`obra-status-badge ${getObraStatusClass(status)}`}>
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
                  <span className="obra-value monetary">{formatCurrencyBrl(regBanco?.ValorInicial)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Valor Inicial + Aditivo</span>
                  <span className="obra-value monetary">{formatCurrencyBrl(regBanco?.ValorInicialAditivo)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Reajuste Total</span>
                  <span className="obra-value monetary">{formatCurrencyBrl(regBanco?.ValorTotalReajuste)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Valor Saldo</span>
                  <span className="obra-value monetary">{formatCurrencyBrl(regBanco?.ValorSaldo)}</span>
                </div>
              </div>

              <ObraFinancialChart
                valorInicial={regBanco?.ValorInicial}
                valorInicialAditivo={regBanco?.ValorInicialAditivo}
                valorTotalReajuste={regBanco?.ValorTotalReajuste}
                valorSaldo={regBanco?.ValorSaldo}
              />
            </div>

            <div className="obra-section-card">
              <div className="obra-section-header">
                <i className="fa-solid fa-calendar-days" />
                <span>Vigência e Prazos</span>
              </div>
              <div className="obra-grid">
                <div className="obra-field">
                  <span className="obra-label">Data de Início</span>
                  <span className="obra-value">{formatDatePtBr(regBanco?.DataInicio)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Término Vigência</span>
                  <span className="obra-value">{formatDatePtBr(regBanco?.DataTerminoVigencia)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Término Atualizada</span>
                  <span className="obra-value">{formatDatePtBr(regBanco?.DataTerminoAtualizada)}</span>
                </div>
                <div className="obra-field">
                  <span className="obra-label">Data de Carga / Vínculo</span>
                  <span className="obra-value">
                    {formatDatePtBr(regBanco?.DataCarga || regBanco?.DataVinculo)}
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
