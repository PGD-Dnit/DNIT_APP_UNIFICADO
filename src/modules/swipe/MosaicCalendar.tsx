import { useState, useMemo } from "react";
import Calendar from "react-calendar";
import "react-calendar/dist/Calendar.css";
import "./MosaicCalendar.css";

interface MosaicDate {
  mosaic_name?: string;
  date?: string;   // "YYYY-MM-DD" ou "YYYY-MM"
  when?: string;
  label?: string;
  year?: number;
  month?: number;
  day?: number;
  id?: string;
}

interface Props {
  mosaics?: MosaicDate[];
  onSelect?: (mosaic: MosaicDate) => void;
  onSelectDroneDate?: (dayKey: string) => void;
  title?: string;
  align?: "left" | "right";
  selected?: { year: number; month: number; day?: number } | null;
  onChangeSelected?: (sel: { year: number; month: number; day?: number } | null) => void;
  droneDates?: Set<string>;
}

export default function MosaicCalendar({
  mosaics = [],
  onSelect = () => {},
  onSelectDroneDate,
  title = "Mosaicos disponíveis",
  align = "right",
  selected,
  onChangeSelected,
  droneDates,
}: Props) {
  const [uncontrolled, setUncontrolled] = useState<{ year: number; month: number; day?: number } | null>(null);

  const isControlled = selected !== undefined;
  const currentSelected = isControlled ? selected : uncontrolled;

  // Normaliza datas para YYYY-MM-DD ou YYYY-MM-01
  const normalized = useMemo(() => {
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
            // new Date(y, mo, 0) pega exatamente o último dia do mês 'mo'
            d = new Date(y, mo, 0).getDate();
          }
        }
        
        return {
          ...m,
          year: y,
          month: mo,
          day: d,
          label: `${String(d).padStart(2, "0")}/${String(mo).padStart(2, "0")}/${y}`,
        };
      })
      .filter((m) => m.year! > 0 && m.month! > 0);
  }, [mosaics]);

  const availableDatesSet = useMemo(() => {
    return new Set(normalized.map((m) => `${m.year}-${m.month}-${m.day}`));
  }, [normalized]);

  // Define a data atual baseada na seleção ou no mosaico mais recente
  const activeDate = useMemo(() => {
    if (currentSelected?.year && currentSelected?.month) {
        return new Date(currentSelected.year, currentSelected.month - 1, currentSelected.day || 1);
    }
    if (normalized.length > 0) {
        const sorted = [...normalized].sort((a,b) => {
            const da = new Date(a.year!, a.month! - 1, a.day!).getTime();
            const db = new Date(b.year!, b.month! - 1, b.day!).getTime();
            return db - da; // decrescente (mais recente primeiro)
        });
        const latest = sorted[0];
        return new Date(latest.year!, latest.month! - 1, latest.day!);
    }
    return new Date();
  }, [currentSelected, normalized]);

  const handleSelectDay = (date: Date) => {
    const y = date.getFullYear();
    const mo = date.getMonth() + 1;
    const d = date.getDate();
    const dayKey = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

    // 🚁 Data de drone clicada → notifica SwipePage para aplicar as layers
    if (droneDates && droneDates.has(dayKey) && onSelectDroneDate) {
      onSelectDroneDate(dayKey);
      if (isControlled) {
        onChangeSelected?.({ year: y, month: mo, day: d });
      } else {
        setUncontrolled({ year: y, month: mo, day: d });
      }
      return;
    }

    // 🛰️ Data de mosaico Planet clicada
    const mosaic = normalized.find((m) => m.year === y && m.month === mo && m.day === d);
    if (mosaic) {
      onSelect(mosaic);
      if (isControlled) {
        onChangeSelected?.({ year: y, month: mo, day: d });
      } else {
        setUncontrolled({ year: y, month: mo, day: d });
      }
    }
  };

  const tileDisabled = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const y = date.getFullYear();
      const mo = date.getMonth() + 1;
      const d = date.getDate();
      const dayKey = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      // Datas drone também ficam habilitadas para clique
      if (droneDates && droneDates.has(dayKey)) return false;
      return !availableDatesSet.has(`${y}-${mo}-${d}`);
    }
    return false;
  };
  
  const tileClassName = ({ date, view }: { date: Date; view: string }) => {
    if (view === "month") {
      const y = date.getFullYear();
      const mo = date.getMonth() + 1;
      const d = date.getDate();
      const dateStr = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      
      let classes = [];
      if (droneDates && droneDates.has(dateStr)) {
        classes.push("drone-date-highlight");
      }
      if (availableDatesSet.has(`${y}-${mo}-${d}`)) {
        classes.push("highlight-date"); 
      }
      return classes.length > 0 ? classes.join(" ") : null;
    }
    return null;
  };

  if (!normalized.length) {
    return (
      <div className="calendar-view-container empty">
        <p style={{ fontSize: "0.9rem", opacity: 0.8 }}>Nenhum mosaico disponível.</p>
      </div>
    );
  }

  return (
    <div className={`calendar-view-container ${align === "left" ? "calendar-left" : "calendar-right"}`} style={{ padding: "10px" }}>
      <div className="calendar-header" style={{ marginBottom: 10 }}>
        <h4 style={{ margin: 0, textAlign: "center" }}>{title}</h4>
      </div>

      <Calendar 
        onClickDay={handleSelectDay} 
        value={activeDate}
        tileDisabled={tileDisabled}
        tileClassName={tileClassName}
        minDetail="year"
        next2Label={null}
        prev2Label={null}
        locale="pt-BR"
      />
    </div>
  );
}

