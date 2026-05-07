import { useMemo, useState } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./TemporalLayersPanel.css";
import { useAppStore } from "../../core/store";

export type TemporalTab = "mosaics" | "drone" | "image360";
export type SwipeSide = "left" | "right";

interface Props {
  mosaics?: any[]; // Array of PlanetMosaicUI
  droneDates?: Set<string>;
  image360Dates?: Set<string>;

  onClose?: () => void;
  onMosaicApply?: (side: SwipeSide, mosaic: any) => void;
  onDroneApply?: (side: SwipeSide, dayKey: string) => void;

  // Handlers for side selection so parent can keep UI updated
  selectedSide?: SwipeSide;
  onSideChange?: (side: SwipeSide) => void;
}

export default function TemporalLayersPanel({
  mosaics = [],
  droneDates = new Set(),
  image360Dates = new Set(),
  onClose,
  onMosaicApply,
  onDroneApply,
  selectedSide = "left",
  onSideChange
}: Props) {
  const [activeTab, setActiveTab] = useState<TemporalTab>("mosaics");

  // Local state for selected side (if not controlled by parent)
  const [localSide, setLocalSide] = useState<SwipeSide>("left");
  const activeSide = onSideChange ? selectedSide : localSide;

  // Local states for inputs
  const droneDateFilter = useAppStore(s => s.droneDateFilter);
  const setDroneDateFilter = useAppStore(s => s.setDroneDateFilter);
  const image360DateFilter = useAppStore(s => s.image360DateFilter);
  const setImage360DateFilter = useAppStore(s => s.setImage360DateFilter);
  const image360AvailableDates = useAppStore(s => s.image360AvailableDates);

  // Parse dates for HTML inputs (YYYY-MM-DD)
  const toDateString = (ts: number | null) => {
    if (!ts) return "";
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  const [droneStart, setDroneStart] = useState<string>(toDateString(droneDateFilter.start));
  const [droneEnd, setDroneEnd] = useState<string>(toDateString(droneDateFilter.end));

  const [img360Start, setImg360Start] = useState<string>(toDateString(image360DateFilter.start));
  const [img360End, setImg360End] = useState<string>(toDateString(image360DateFilter.end));

  const [selectedMosaicDate, setSelectedMosaicDate] = useState<Date | null>(null);
  const [selectedMosaicObj, setSelectedMosaicObj] = useState<any | null>(null);

  const [selectedDroneDate, setSelectedDroneDate] = useState<Date | null>(null);
  const [selectedDroneDayKey, setSelectedDroneDayKey] = useState<string | null>(null);

  // Normalize mosaics for calendar
  const normalizedMosaics = useMemo(() => {
    return mosaics
      .map((m) => {
        const raw = m.date || m.when || m.label || "";
        let y = 0, mo = 0, d = 1;
        let hit = String(raw).match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
        if (hit) {
          y = parseInt(hit[1], 10);
          mo = parseInt(hit[2], 10);
          d = parseInt(hit[3], 10);
        } else {
          hit = String(raw).match(/(\d{4})[-_/\.](\d{2})/);
          if (hit) {
            y = parseInt(hit[1], 10);
            mo = parseInt(hit[2], 10);
            d = new Date(y, mo, 0).getDate();
          }
        }
        return { ...m, year: y, month: mo, day: d };
      })
      .filter((m) => m.year > 0 && m.month > 0);
  }, [mosaics]);

  const availableMosaicsSet = useMemo(() => {
    return new Set(normalizedMosaics.map((m) => `${m.year}-${m.month}-${m.day}`));
  }, [normalizedMosaics]);

  // Calendar render functions
  const tileContent = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const y = date.getFullYear();
      const mo = date.getMonth() + 1;
      const d = date.getDate();

      const keyDay = `${y}-${mo}-${d}`;
      const keyZeroPad = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

      const hasMosaic = availableMosaicsSet.has(keyDay);
      const hasDrone = droneDates.has(keyZeroPad);
      const has360 = image360Dates.has(keyZeroPad) || image360AvailableDates.has(keyZeroPad);

      if (hasMosaic || hasDrone || has360) {
        return (
          <div className="temporal-indicators">
            {hasMosaic && <div className="temp-dot mosaic" />}
            {hasDrone && <div className="temp-dot drone" />}
            {has360 && <div className="temp-dot image360" />}
          </div>
        );
      }
    }
    return null;
  };

  const handleDayClick = (date: Date) => {
    const y = date.getFullYear();
    const mo = date.getMonth() + 1;
    const d = date.getDate();

    if (activeTab === "mosaics") {
      const mosaic = normalizedMosaics.find((m) => m.year === y && m.month === mo && m.day === d);
      if (mosaic) {
        setSelectedMosaicDate(date);
        setSelectedMosaicObj(mosaic);
      }
    } else if (activeTab === "drone") {
      const yStr = String(y);
      const moStr = String(mo).padStart(2, "0");
      const dStr = String(d).padStart(2, "0");
      const dayKey = `${yStr}-${moStr}-${dStr}`;

      setSelectedDroneDate(date);
      setSelectedDroneDayKey(dayKey);
    } else if (activeTab === "image360") {
      const str = toDateString(date.getTime());
      setImg360Start(str);
      setImg360End(str);
    }
  };

  const handleApply = () => {
    if (activeTab === "mosaics" && selectedMosaicObj) {
      onMosaicApply?.(activeSide, selectedMosaicObj);
    } else if (activeTab === "drone") {
      const startMs = droneStart ? new Date(droneStart + "T00:00:00").getTime() : null;
      const endMs = droneEnd ? new Date(droneEnd + "T23:59:59").getTime() : null;
      setDroneDateFilter({ start: startMs, end: endMs });

      if (selectedDroneDayKey) {
        onDroneApply?.(activeSide, selectedDroneDayKey);
      }
    } else if (activeTab === "image360") {
      const startMs = img360Start ? new Date(img360Start + "T00:00:00").getTime() : null;
      const endMs = img360End ? new Date(img360End + "T23:59:59").getTime() : null;
      setImage360DateFilter({ start: startMs, end: endMs });
    }
  };

  const handleClear = () => {
    if (activeTab === "mosaics") {
      setSelectedMosaicDate(null);
      setSelectedMosaicObj(null);
    } else if (activeTab === "drone") {
      setDroneStart("");
      setDroneEnd("");
      setDroneDateFilter({ start: null, end: null });
      setSelectedDroneDate(null);
      setSelectedDroneDayKey(null);
    } else if (activeTab === "image360") {
      setImg360Start("");
      setImg360End("");
      setImage360DateFilter({ start: null, end: null });
    }
  };

  const handleSideClick = (side: SwipeSide) => {
    if (onSideChange) onSideChange(side);
    else setLocalSide(side);
  };

  return (
    <div className="temporal-panel-container">
      <div className="temporal-panel-header">
        <h3>Calendário</h3>
        {onClose && (
          <button className="temporal-close-btn" onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <div className="temporal-tabs">
        <button
          className={`temporal-tab-btn ${activeTab === "mosaics" ? "active" : ""}`}
          onClick={() => setActiveTab("mosaics")}
        >
          Mosaics
        </button>
        <button
          className={`temporal-tab-btn ${activeTab === "drone" ? "active" : ""}`}
          onClick={() => setActiveTab("drone")}
        >
          Drone
        </button>
        <button
          className={`temporal-tab-btn ${activeTab === "image360" ? "active" : ""}`}
          onClick={() => setActiveTab("image360")}
        >
          Imagem 360
        </button>
      </div>

      <div className="temporal-content">
        {(activeTab === "mosaics" || activeTab === "drone") && (
          <div className="temporal-swipe-selection">
            <label>Aplicar no swipe / mapas:</label>
            <div className="temporal-swipe-buttons">
              <button
                className={`temporal-side-btn ${activeSide === "left" ? "active" : ""}`}
                onClick={() => handleSideClick("left")}
              >
                Esquerda
              </button>
              <button
                className={`temporal-side-btn ${activeSide === "right" ? "active" : ""}`}
                onClick={() => handleSideClick("right")}
              >
                Direita
              </button>
            </div>
            <span style={{ fontSize: "0.75rem", color: "#888", marginTop: 4 }}>
              Clique em uma data para alterar o {activeTab === "mosaics" ? "mosaic" : "drone"}
            </span>
          </div>
        )}

        {activeTab === "drone" && (
          <div className="temporal-filter-container">
            <div className="temporal-filter-row">
              <label>Início:</label>
              <input type="date" className="temporal-filter-input" value={droneStart} onChange={e => setDroneStart(e.target.value)} />
            </div>
            <div className="temporal-filter-row">
              <label>Fim:</label>
              <input type="date" className="temporal-filter-input" value={droneEnd} onChange={e => setDroneEnd(e.target.value)} />
            </div>
          </div>
        )}

        {activeTab === "image360" && (
          <div className="temporal-filter-container">
            <div className="temporal-filter-row">
              <label>Início:</label>
              <input type="date" className="temporal-filter-input" value={img360Start} onChange={e => setImg360Start(e.target.value)} />
            </div>
            <div className="temporal-filter-row">
              <label>Fim:</label>
              <input type="date" className="temporal-filter-input" value={img360End} onChange={e => setImg360End(e.target.value)} />
            </div>
          </div>
        )}

        <div className="temporal-calendar-wrapper">
          <Calendar
            onClickDay={handleDayClick}
            tileContent={tileContent}
            minDetail="year"
            next2Label={null}
            prev2Label={null}
            locale="pt-BR"
            showNeighboringMonth={false}
          />
        </div>
      </div>

      <div className="temporal-footer">
        <div className="temporal-status">
          {activeTab === "mosaics" && selectedMosaicDate && (
            <span>Mosaic selecionado: {selectedMosaicDate.toLocaleDateString("pt-BR")}</span>
          )}
          {activeTab === "drone" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {(droneDateFilter.start || droneDateFilter.end) && <span>Filtro de drone ativo</span>}
              {selectedDroneDate && <span>Drone selecionado: {selectedDroneDate.toLocaleDateString("pt-BR")}</span>}
            </div>
          )}
          {activeTab === "image360" && image360DateFilter.start && (
            <span>Filtro de Imagem 360 ativo</span>
          )}
        </div>
        <div className="temporal-actions">
          <button className="temporal-btn-limpar" onClick={handleClear}>Limpar</button>
          <button className="temporal-btn-aplicar" onClick={handleApply}>Aplicar</button>
        </div>
      </div>

      <div className="temporal-legend">
        <div className="temporal-legend-item">
          <div className="temporal-legend-dot mosaic" style={{ background: '#3498db' }}></div>
          <span>mosaics</span>
        </div>
        <div className="temporal-legend-item">
          <div className="temporal-legend-dot drone" style={{ background: '#e74c3c' }}></div>
          <span>drone</span>
        </div>
        <div className="temporal-legend-item">
          <div className="temporal-legend-dot image360" style={{ background: '#2ecc71' }}></div>
          <span>imagem 360</span>
        </div>
      </div>
    </div>
  );
}
