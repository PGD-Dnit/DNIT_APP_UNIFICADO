// src/components/ObraFinancialChart.tsx
import React from "react";
import "./ObraFinancialChart.css";

interface Props {
  valorInicial?: number | null;
  valorInicialAditivo?: number | null;
  valorTotalReajuste?: number | null;
  valorSaldo?: number | null;
}

export const ObraFinancialChart: React.FC<Props> = ({
  valorInicial = 0,
  valorInicialAditivo = 0,
  valorTotalReajuste = 0,
  valorSaldo = 0,
}) => {
  const vInicial = Math.max(0, valorInicial || 0);
  const vAditivo = Math.max(0, (valorInicialAditivo || 0) - vInicial);
  const vReajuste = Math.max(0, valorTotalReajuste || 0);
  const vSaldo = Math.max(0, valorSaldo || 0);

  const totalOrcamento = Math.max(vInicial + vAditivo + vReajuste, vSaldo);
  const vExecutado = Math.max(0, totalOrcamento - vSaldo);

  const pctSaldo = totalOrcamento > 0 ? (vSaldo / totalOrcamento) * 100 : 100;
  const pctExecutado = totalOrcamento > 0 ? (vExecutado / totalOrcamento) * 100 : 0;
  const pctAditivos = totalOrcamento > 0 ? ((vAditivo + vReajuste) / totalOrcamento) * 100 : 0;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }).format(val);
  };

  // Parâmetros SVG para o Donut Chart
  const size = 140;
  const strokeWidth = 14;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  // Calculando arcos
  const dashExecutado = (pctExecutado / 100) * circumference;
  const dashSaldo = (pctSaldo / 100) * circumference;
  const dashAditivos = (pctAditivos / 100) * circumference;

  const offsetExecutado = 0;
  const offsetSaldo = -dashExecutado;
  const offsetAditivos = -(dashExecutado + dashSaldo);

  return (
    <div className="financial-chart-container">
      <div className="financial-chart-content">
        {/* Gráfico de Donut SVG */}
        <div className="financial-donut-wrapper">
          <svg className="financial-donut-svg" viewBox={`0 0 ${size} ${size}`}>
            {/* Base Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke="rgba(255, 255, 255, 0.08)"
              strokeWidth={strokeWidth}
            />

            {/* Segmento 1: Saldo Restante (Verde) */}
            {pctSaldo > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#10b981"
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashSaldo} ${circumference}`}
                strokeDashoffset={offsetSaldo}
                strokeLinecap="round"
              />
            )}

            {/* Segmento 2: Executado/Pago (Azul) */}
            {pctExecutado > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#3b82f6"
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashExecutado} ${circumference}`}
                strokeDashoffset={offsetExecutado}
                strokeLinecap="round"
              />
            )}

            {/* Segmento 3: Aditivos & Reajuste (Laranja) */}
            {pctAditivos > 0 && (
              <circle
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke="#f59e0b"
                strokeWidth={strokeWidth}
                strokeDasharray={`${dashAditivos} ${circumference}`}
                strokeDashoffset={offsetAditivos}
                strokeLinecap="round"
              />
            )}
          </svg>

          {/* Valor Central no Donut */}
          <div className="financial-donut-center">
            <span className="financial-center-val">{pctSaldo.toFixed(0)}%</span>
            <span className="financial-center-lbl">Saldo</span>
          </div>
        </div>

        {/* Legenda e Métricas em R$ */}
        <div className="financial-legend-grid">
          <div className="financial-legend-item">
            <div className="financial-legend-dot" style={{ background: "#10b981" }} />
            <div className="financial-legend-info">
              <span className="financial-legend-title">Saldo Restante</span>
              <span className="financial-legend-val">
                {formatCurrency(vSaldo)}
                <span className="financial-legend-pct" style={{ color: "#10b981" }}>
                  ({pctSaldo.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          <div className="financial-legend-item">
            <div className="financial-legend-dot" style={{ background: "#3b82f6" }} />
            <div className="financial-legend-info">
              <span className="financial-legend-title">Valor Executado</span>
              <span className="financial-legend-val">
                {formatCurrency(vExecutado)}
                <span className="financial-legend-pct" style={{ color: "#3b82f6" }}>
                  ({pctExecutado.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>

          <div className="financial-legend-item">
            <div className="financial-legend-dot" style={{ background: "#f59e0b" }} />
            <div className="financial-legend-info">
              <span className="financial-legend-title">Aditivos & Reajustes</span>
              <span className="financial-legend-val">
                {formatCurrency(vAditivo + vReajuste)}
                <span className="financial-legend-pct" style={{ color: "#f59e0b" }}>
                  ({pctAditivos.toFixed(1)}%)
                </span>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Barra de Progresso Empilhada */}
      <div className="financial-progress-section">
        <div className="financial-progress-header">
          <span>Distribuição do Orçamento Total</span>
          <span>Total: {formatCurrency(totalOrcamento)}</span>
        </div>
        <div className="financial-progress-bar">
          <div
            className="financial-progress-segment"
            style={{ width: `${pctExecutado}%`, background: "#3b82f6" }}
            title={`Executado: ${pctExecutado.toFixed(1)}%`}
          />
          <div
            className="financial-progress-segment"
            style={{ width: `${pctSaldo}%`, background: "#10b981" }}
            title={`Saldo: ${pctSaldo.toFixed(1)}%`}
          />
          <div
            className="financial-progress-segment"
            style={{ width: `${pctAditivos}%`, background: "#f59e0b" }}
            title={`Aditivos/Reajuste: ${pctAditivos.toFixed(1)}%`}
          />
        </div>
      </div>
    </div>
  );
};

export default ObraFinancialChart;
