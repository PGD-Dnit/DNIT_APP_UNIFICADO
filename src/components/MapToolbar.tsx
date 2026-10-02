import { useAppStore } from "../core/store";
import mapaIcon from "../assets/icons/toolbar/mapa.svg";
import swipeIcon from "../assets/icons/toolbar/swipe.svg";
import compararIcon from "../assets/icons/toolbar/comparar.svg";
import calendarioIcon from "../assets/icons/toolbar/calendario.svg";
import camadasIcon from "../assets/icons/toolbar/camadas.svg";
import "./MapToolbar.css";

interface MapToolbarProps {
  /**
   * Exibe o botão "Mostrar Camadas".
   * Use false em viewers que não possuem painel de camadas (ex: MapaInicialViewer).
   * @default true
   */
  showLayersBtn?: boolean;
}

/**
 * MapToolbar — barra de ferramentas flutuante sobre o mapa.
 *
 * Grupo Ferramentas:
 *   - Calendário com filtro  (abre/fecha TemporalLayersPanel)
 *   - Mostrar Camadas        (abre/fecha painel de camadas)
 *
 * Grupo Visualização:
 *   - Mapa Inicial
 *   - Swipe
 *   - 2 Mapas Independentes
 *
 * Estado gerenciado pelo useAppStore para persistir entre trocas de modo.
 */
export default function MapToolbar({ showLayersBtn = true }: MapToolbarProps) {
  const activeMode = useAppStore((s) => s.activeMode);
  const dualMode = useAppStore((s) => s.dualMode);
  const setVisualizationMode = useAppStore((s) => s.setVisualizationMode);

  const showTemporalPanel = useAppStore((s) => s.showTemporalPanel);
  const setShowTemporalPanel = useAppStore((s) => s.setShowTemporalPanel);

  const showCamadas = useAppStore((s) => s.showCamadas);
  const setShowCamadas = useAppStore((s) => s.setShowCamadas);

  return (
    <div className="map-toolbar">
      <div style={{ height: "2px" }} />
      <p className="map-toolbar-title">Ferramentas</p>
      <div style={{ height: "5px" }} />
      {/* ══ GRUPO FERRAMENTAS ══ */}
      <div className="map-toolbar-group">
        {/* Calendário com filtro */}
        <button
          className={`map-toolbar-btn${showTemporalPanel ? " active" : ""}`}
          title="Calendário com filtro"
          aria-label="Calendário com filtro"
          onClick={() => setShowTemporalPanel(!showTemporalPanel)}
        >
          {showTemporalPanel
            ? <i className="fa-solid fa-xmark" />
            : <img src={calendarioIcon} alt="" className="map-toolbar-svg-icon" />}
        </button>
        <span className="map-toolbar-label">Calendário</span>
        <div style={{ height: "2px" }} />

        {/* Mostrar Camadas */}
        {showLayersBtn && (
          <button
            className={`map-toolbar-btn${showCamadas ? " active" : ""}`}
            title={showCamadas ? "Esconder camadas" : "Mostrar camadas"}
            aria-label={showCamadas ? "Esconder camadas" : "Mostrar camadas"}
            onClick={() => setShowCamadas(!showCamadas)}
          >
            {showCamadas
              ? <i className="fa-solid fa-xmark" />
              : <img src={camadasIcon} alt="" className="map-toolbar-svg-icon" />}
          </button>
        )}
        <span className="map-toolbar-label">Camadas</span>
      </div>

      {/* Divisor visual entre grupos */}
      <div style={{ height: "5px" }} />
      <div className="map-toolbar-divider" aria-hidden="true" />
      <div style={{ height: "2px" }} />
      <p className="map-toolbar-title">Visualização</p>
      <div style={{ height: "5px" }} />
      {/* ══ GRUPO VISUALIZAÇÃO ══ */}
      <div className="map-toolbar-group">

        {/* Mapa Inicial */}
        <button
          className={`map-toolbar-btn${activeMode === "mapa_inicial" ? " active" : ""}`}
          title="Mapa Inicial"
          aria-label="Mapa Inicial"
          onClick={() => setVisualizationMode("mapa_inicial", false)}
        >
          <img src={mapaIcon} alt="" className="map-toolbar-svg-icon" />
        </button>
        <span className="map-toolbar-label">Mapa</span>
        <div style={{ height: "2px" }} />

        {/* Swipe */}
        <button
          className={`map-toolbar-btn${activeMode === "swipe" && !dualMode ? " active" : ""}`}
          title="Swipe"
          aria-label="Modo Swipe"
          onClick={() => setVisualizationMode("swipe", false)}
        >
          <img src={swipeIcon} alt="" className="map-toolbar-svg-icon" />
        </button>
        <span className="map-toolbar-label">Swipe</span>
        <div style={{ height: "2px" }} />

        {/* 2 Mapas Independentes */}
        <button
          className={`map-toolbar-btn${activeMode === "swipe" && dualMode ? " active" : ""}`}
          title="2 Mapas Independentes"
          aria-label="2 Mapas Independentes"
          onClick={() => setVisualizationMode("swipe", true)}
        >
          <img src={compararIcon} alt="" className="map-toolbar-svg-icon" />
        </button>
        <span className="map-toolbar-label">Comparar</span>
        <div style={{ height: "2px" }} />
      </div>

    </div>
  );
}
