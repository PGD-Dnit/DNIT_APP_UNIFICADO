import React, { useEffect, useMemo, useState } from "react";
import "./MarkedCalendar.css";

function ymd(d: Date) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
}

function normalizeDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function MarkedCalendar({
    markedDates,
    onPick,
    selectedDate,
}: {
    markedDates: Date[];
    onPick: (d: Date) => void;
    selectedDate?: Date | null;
}) {
    const [cursor, setCursor] = useState(() => {
        const sorted = [...markedDates]
            .filter(Boolean)
            .map(normalizeDay)
            .sort((a, b) => b.getTime() - a.getTime());
        return sorted[0] ?? new Date();
    });

    useEffect(() => {
        const sorted = [...markedDates]
            .filter(Boolean)
            .map(normalizeDay)
            .sort((a, b) => b.getTime() - a.getTime());
        if (sorted[0]) setCursor(sorted[0]);
    }, [markedDates]);

    const markedSet = useMemo(() => {
        const s = new Set<string>();
        for (const d of markedDates) s.add(ymd(normalizeDay(d)));
        return s;
    }, [markedDates]);

    const selectedKey = selectedDate ? ymd(normalizeDay(selectedDate)) : null;

    const year = cursor.getFullYear();
    const month = cursor.getMonth();

    const first = new Date(year, month, 1);
    const startDow = first.getDay(); // 0=dom
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: (Date | null)[] = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));

    const headers = ["D", "S", "T", "Q", "Q", "S", "S"];

    return (
        <div className="mc">
            <div className="mc__top">
                <button className="mc__nav" onClick={() => setCursor(new Date(year, month - 1, 1))}>◀
                </button>

                <div className="mc__title">
                    {cursor.toLocaleString("pt-BR", { month: "short" })} {year}
                </div>

                <button className="mc__nav" onClick={() => setCursor(new Date(year, month + 1, 1))}>▶
                </button>
            </div>

            <div className="mc__grid">
                {headers.map((h, i) => (
                    <div key={`${h}-${i}`} className="mc__hdr">
                        {h}
                    </div>
                ))}

                {cells.map((d, idx) => {
                    if (!d) return <div key={`e-${idx}`} />;

                    const key = ymd(d);
                    const isMarked = markedSet.has(key);
                    const isSelected = selectedKey === key;

                    return (
                        <button
                            key={key}
                            className={[
                                "mc__day",
                                isMarked ? "is-marked" : "is-disabled",
                                isSelected ? "is-selected" : "",
                            ].join(" ")}
                            disabled={!isMarked}
                            onClick={() => onPick(d)}
                            title={isMarked ? "Tem imagem nesta data" : ""}
                            type="button"
                        >
                            {d.getDate()}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
