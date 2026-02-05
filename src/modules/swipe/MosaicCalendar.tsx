import React, { useState, useMemo, useEffect } from "react";
import "react-calendar/dist/Calendar.css";
import "./MosaicCalendar.css";

interface MosaicDate {
  mosaic_name?: string;
  date?: string;   // "YYYY-MM"
  when?: string;   // "YYYY-MM"
  label?: string;
  // estes dois são acrescentados na normalização:
  year?: number;
  month?: number;
}

interface Props {
  mosaics?: MosaicDate[];
  onSelect?: (mosaic: MosaicDate) => void;
  title?: string;
  align?: "left" | "right";
  /** seleção controlada pelo pai (ano/mês) */
  selected?: { year: number; month: number } | null;
  /** callback para o pai atualizar sua seleção */
  onChangeSelected?: (sel: { year: number; month: number } | null) => void;
}

export default function MosaicCalendar({
  mosaics = [],
  onSelect = () => {},
  title = "Mosaicos disponíveis",
  align = "right",
  selected,
  onChangeSelected,
}: Props) {
  const [year, setYear] = useState(new Date().getFullYear());
  const [uncontrolled, setUncontrolled] = useState<{ year: number; month: number } | null>(null);

  const isControlled = selected !== undefined;
  const currentSelected = isControlled ? selected : uncontrolled;

  // Normaliza datas (robusto p/ strings tipo "YYYY-MM qualquer coisa")
  const normalized = useMemo(() => {
    const arr = mosaics.map((m) => {
      const raw = m.date || m.when || m.label || "";
      let y = 0, mo = 0;
      const hit = String(raw).match(/(\d{4})[-_/\.](\d{2})/);
      if (hit) { y = parseInt(hit[1], 10); mo = parseInt(hit[2], 10); }
      return {
        ...m,
        year: y,
        month: mo,
        label: `${String(mo).padStart(2, "0")}/${y}`,
      };
    }).filter(m => m.year! > 0 && m.month! > 0);
    return arr;
  }, [mosaics]);

  // Meses disponíveis por ano
  const availableMonths = useMemo(() => {
    const map = new Map<number, number[]>();
    normalized.forEach(({ year, month }) => {
      const y = year!, mo = month!;
      if (!map.has(y)) map.set(y, []);
      const arr = map.get(y)!;
      if (!arr.includes(mo)) arr.push(mo);
    });
    for (const [y, arr] of map) map.set(y, arr.sort((a,b)=>a-b));
    return map;
  }, [normalized]);

  // Ano inicial: se tem uma seleção, usa o ano dela; senão, último ano com dados; senão, ano atual
  useEffect(() => {
    if (currentSelected?.year) { setYear(currentSelected.year); return; }
    const years = Array.from(availableMonths.keys()).sort((a,b)=>a-b);
    if (years.length) setYear(years[years.length - 1]);
  }, [currentSelected, availableMonths]);

  const months = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

  if (!normalized.length) {
    return (
      <div className="calendar-view-container empty">
        <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Nenhum mosaico disponível.</p>
      </div>
    );
  }

  const setSelected = (sel: { year: number; month: number } | null) => {
    if (isControlled) onChangeSelected?.(sel);
    else setUncontrolled(sel);
  };

  const handleSelectMonth = (monthIndex: number) => {
    const month = monthIndex + 1;
    if (!availableMonths.get(year)?.includes(month)) return;
    const mosaic = normalized.find(m => m.year === year && m.month === month);
    if (mosaic) onSelect(mosaic);
    setSelected({ year, month });
  };

  return (
    <div className={`calendar-view-container ${align === "left" ? "calendar-left" : "calendar-right"}`}>
      <div className="calendar-header"><h4>{title}</h4></div>

      <div className="year-selector">
        <button onClick={() => setYear(y => y - 1)}>◀</button>
        <span>{year}</span>
        <button onClick={() => setYear(y => y + 1)}>▶</button>
      </div>

      <div className="month-grid">
        {months.map((mName, idx) => {
          const month = idx + 1;
          const isAvailable = availableMonths.get(year)?.includes(month) ?? false;
          const isSelected = currentSelected?.year === year && currentSelected?.month === month;

          return (
            <button
              key={idx}
              type="button"
              className={`month-cell ${isAvailable ? "highlight-date" : "disabled-date"} ${isSelected ? "selected-date" : ""}`}
              onClick={() => handleSelectMonth(idx)}
              title={isAvailable ? `Ver mosaico ${String(month).padStart(2,"0")}/${year}` : "Sem mosaico neste mês"}
              aria-pressed={isSelected}
              disabled={!isAvailable}
            >
              {mName}
            </button>
          );
        })}
      </div>
    </div>
  );
}
