// src/modules/imagem_obra/SingleImageScreen.tsx
import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../core/store";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import MiniMapImageView from "./MiniMapImageView";
import SingleImageViewer from "./SingleImageViewer";
import ImageToggleBtn from "./ImageToggleBtn";

import "./SingleImageScreen.css";

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

function EmptyState({ icon, msg, sub }: { icon: string; msg: string; sub?: string }) {
  return (
    <div className="sis__empty">
      <div className="sis__empty__card">
        <i className={`fa-solid ${icon} sis__empty__icon`} />
        <span>{msg}</span>
        {sub && <span className="sis__empty__sub">{sub}</span>}
      </div>
    </div>
  );
}

export default function SingleImageScreen() {
  const candidateImages = useAppStore((s) => s.candidateImages);
  const leftExp = useAppStore((s) => s.selectedImageLeft);
  const setLeftExp = useAppStore((s) => s.setSelectedImageLeft);
  const setImageLeft = useAppStore((s) => s.setImageLeft);

  const [imgStatus, setImgStatus] = useState<ImgStatus>("waiting");
  const [imgUrl, setImgUrl] = useState<string | null>(null);

  // Carrega o attachment quando a exposição esquerda muda
  useEffect(() => {
    if (!leftExp) {
      setImgStatus("waiting");
      setImgUrl(null);
      setImageLeft(null);
      return;
    }

    let cancelled = false;
    setImgStatus("loading");
    setImgUrl(null);
    setImageLeft(null);

    (async () => {
      try {
        const list = await listAttachments(leftExp.layerUrl, leftExp.objectId);
        if (cancelled) return;

        const best = pickBest(list);
        if (!best) {
          setImgStatus("empty");
          return;
        }

        const url = buildAttachmentUrl(leftExp.layerUrl, leftExp.objectId, best.id);
        setImgUrl(url);
        setImgStatus("ready");
        setImageLeft({
          objectId: leftExp.objectId,
          attachmentId: best.id,
          url,
          name: best.name ?? undefined,
          contentType: best.contentType ?? undefined,
        });
      } catch {
        if (!cancelled) setImgStatus("empty");
      }
    })();

    return () => { cancelled = true; };
  }, [leftExp?.layerUrl, leftExp?.objectId, leftExp, setImageLeft]);

  // Datas marcadas no calendário
  const markedDates = useMemo(() => {
    return candidateImages
      .map((c) => c.attrs?.acquisitiondate)
      .filter((v) => typeof v === "number" && Number.isFinite(v))
      .map((ms) => normalizeDay(new Date(ms)));
  }, [candidateImages]);

  // Data selecionada atual
  const selectedDate = useMemo(() => {
    const ms = leftExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [leftExp]);

  // Troca de imagem ao clicar no calendário
  const onPickDate = (d: Date) => {
    const dd = normalizeDay(d);
    const found = candidateImages.find((c) => {
      const ms = c.attrs?.acquisitiondate;
      if (typeof ms !== "number" || !Number.isFinite(ms)) return false;
      return sameDay(normalizeDay(new Date(ms)), dd);
    });
    if (found) setLeftExp(found);
  };

  function renderViewer() {
    switch (imgStatus) {
      case "waiting":
        return <EmptyState icon="fa-map-location-dot" msg="Clique em um ponto do mapa para visualizar a imagem" />;
      case "loading":
        return <EmptyState icon="fa-circle-notch fa-spin" msg="Carregando imagem da obra…" />;
      case "empty":
        return (
          <EmptyState
            icon="fa-image-slash"
            msg="Nenhuma imagem disponível para este ponto"
            sub="Tente selecionar outro ponto no mini-mapa"
          />
        );
      case "ready":
        return imgUrl ? <SingleImageViewer url={imgUrl} /> : null;
    }
  }

  return (
    <div className="sis">
      {/* Viewer 2D ocupa todo o fundo */}
      <div className="sis__viewer">
        {renderViewer()}
      </div>

      {/* Calendário — canto superior esquerdo */}
      {markedDates.length > 0 && (
        <div className="sis__calendar">
          <div className="sis__calendarLabel">Datas disponíveis</div>
          <MarkedCalendar
            markedDates={markedDates}
            onPick={onPickDate}
            selectedDate={selectedDate}
          />
        </div>
      )}

      {/* Mini mapa — canto inferior esquerdo */}
      <div className="sis__minimap">
        <MiniMapImageView defaultZoom={18} />
      </div>

      {/* Botão Comparar/Voltar — centro inferior, compartilhado */}
      <ImageToggleBtn />
    </div>
  );
}
