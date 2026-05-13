// src/modules/imagem_obra/CompareImageScreen.tsx
import { useAppStore } from "../../core/store";
import DualImageViewer from "./DualImageViewer";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import MiniMapImageView from "./MiniMapImageView";
import ImageToggleBtn from "./ImageToggleBtn";
import { useEffect, useMemo, useState } from "react";
import "./CompareImageScreen.css";

type Att = { id: number; name?: string; contentType?: string; size?: number };
type ImgStatus = "waiting" | "loading" | "empty" | "ready";

function pickBest(atts: Att[]) {
  const imgs = atts.filter((a) => (a.contentType || "").startsWith("image/"));
  const base = imgs.length ? imgs : atts;
  if (!base.length) return null;
  return base.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0];
}

function normalizeDay(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export default function CompareImageScreen() {
  const candidateImages = useAppStore((s) => s.candidateImages);

  const leftExp = useAppStore((s) => s.selectedImageLeft);
  const setLeftExp = useAppStore((s) => s.setSelectedImageLeft);

  const rightExp = useAppStore((s) => s.selectedImageRight);
  const setRightExp = useAppStore((s) => s.setSelectedImageRight);

  const setImageLeft = useAppStore((s) => s.setImageLeft);
  const setImageRight = useAppStore((s) => s.setImageRight);

  const [leftStatus, setLeftStatus] = useState<ImgStatus>("waiting");
  const [leftUrl, setLeftUrl] = useState<string | null>(null);

  const [rightStatus, setRightStatus] = useState<ImgStatus>("waiting");
  const [rightUrl, setRightUrl] = useState<string | null>(null);

  // Carrega attachment esquerdo
  useEffect(() => {
    if (!leftExp) { setLeftStatus("waiting"); setLeftUrl(null); setImageLeft(null); return; }
    let cancelled = false;
    setLeftStatus("loading"); setLeftUrl(null); setImageLeft(null);
    (async () => {
      try {
        const list = await listAttachments(leftExp.layerUrl, leftExp.objectId);
        if (cancelled) return;
        const best = pickBest(list);
        if (!best) { setLeftStatus("empty"); return; }
        const url = buildAttachmentUrl(leftExp.layerUrl, leftExp.objectId, best.id);
        setLeftUrl(url);
        setLeftStatus("ready");
        setImageLeft({ objectId: leftExp.objectId, attachmentId: best.id, url, name: best.name ?? undefined, contentType: best.contentType ?? undefined });
      } catch { if (!cancelled) setLeftStatus("empty"); }
    })();
    return () => { cancelled = true; };
  }, [leftExp, setImageLeft]);

  // Carrega attachment direito
  useEffect(() => {
    if (!rightExp) { setRightStatus("waiting"); setRightUrl(null); setImageRight(null); return; }
    let cancelled = false;
    setRightStatus("loading"); setRightUrl(null); setImageRight(null);
    (async () => {
      try {
        const list = await listAttachments(rightExp.layerUrl, rightExp.objectId);
        if (cancelled) return;
        const best = pickBest(list);
        if (!best) { setRightStatus("empty"); return; }
        const url = buildAttachmentUrl(rightExp.layerUrl, rightExp.objectId, best.id);
        setRightUrl(url);
        setRightStatus("ready");
        setImageRight({ objectId: rightExp.objectId, attachmentId: best.id, url, name: best.name ?? undefined, contentType: best.contentType ?? undefined });
      } catch { if (!cancelled) setRightStatus("empty"); }
    })();
    return () => { cancelled = true; };
  }, [rightExp, setImageRight]);

  const markedDates = useMemo(() => {
    return candidateImages
      .map((c) => c.attrs?.acquisitiondate)
      .filter((v) => typeof v === "number" && Number.isFinite(v))
      .map((ms) => normalizeDay(new Date(ms)));
  }, [candidateImages]);

  const selectedLeftDate = useMemo(() => {
    const ms = leftExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [leftExp]);

  const selectedRightDate = useMemo(() => {
    const ms = rightExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [rightExp]);

  const onPickLeft = (d: Date) => {
    const dd = normalizeDay(d);
    const found = candidateImages.find((c) => {
      const ms = c.attrs?.acquisitiondate;
      if (typeof ms !== "number") return false;
      return sameDay(normalizeDay(new Date(ms)), dd);
    });
    if (found) setLeftExp(found);
  };

  const onPickRight = (d: Date) => {
    const dd = normalizeDay(d);
    const found = candidateImages.find((c) => {
      const ms = c.attrs?.acquisitiondate;
      if (typeof ms !== "number") return false;
      return sameDay(normalizeDay(new Date(ms)), dd);
    });
    if (found) setRightExp(found);
  };

  return (
    <div className="cps">
      <div className="cps__viewer">
        <DualImageViewer
          urlLeft={leftUrl ?? undefined}
          urlRight={rightUrl ?? undefined}
          statusLeft={leftStatus}
          statusRight={rightStatus}
        />
      </div>

      <div className="cps__panel-left">
        <div className="cps__calendarLabel">Data (Esquerda)</div>
        <MarkedCalendar markedDates={markedDates} onPick={onPickLeft} selectedDate={selectedLeftDate} />
      </div>

      <div className="cps__panel-right">
        <div className="cps__calendarLabel">Data (Direita)</div>
        <MarkedCalendar markedDates={markedDates} onPick={onPickRight} selectedDate={selectedRightDate} />
      </div>

      <div className="cps__minimap">
        <MiniMapImageView defaultZoom={18} />
      </div>

      <ImageToggleBtn />
    </div>
  );
}
