// src/modules/imagem_360/SinglePanoScreen.tsx
// Tela de visualização de UMA imagem 360.
// Exibe o viewer, calendário de datas disponíveis e botão "Comparar"
// que navega para /compare na mesma aba.
import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../core/store";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import MiniMap360View from "./MiniMap360View";
import SinglePanoViewer from "./SinglePanoViewer";
import PanoToggleBtn from "./PanoToggleBtn";

import "./SinglePanoScreen.css";

type Att = { id: number; name?: string; contentType?: string; size?: number };

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

export default function SinglePanoScreen() {
  const candidateExposures = useAppStore((s) => s.candidateExposures);
  const lastClickedPoint = useAppStore((s) => s.lastClickedPoint);
  const leftExp = useAppStore((s) => s.selectedExposureLeft);
  const setLeftExp = useAppStore((s) => s.setSelectedExposureLeft);

  const panoLeft = useAppStore((s) => s.panoLeft);
  const setPanoLeft = useAppStore((s) => s.setPanoLeft);

  const [status, setStatus] = useState<"waiting" | "loading" | "empty" | "ready">("waiting");

  // Carrega o attachment quando a exposição esquerda muda
  useEffect(() => {
    if (!leftExp) {
      setPanoLeft(null);
      setStatus(lastClickedPoint && candidateExposures.length === 0 ? "empty" : "waiting");
      return;
    }

    let cancelled = false;
    setStatus("loading");

    (async () => {
      try {
        const list = await listAttachments(leftExp.layerUrl, leftExp.objectId);
        if (cancelled) return;
        const best = pickBest(list);
        if (!best) {
          setPanoLeft(null);
          setStatus("empty");
          return;
        }

        const url = buildAttachmentUrl(leftExp.layerUrl, leftExp.objectId, best.id);
        if (cancelled) return;

        setPanoLeft({
          objectId: leftExp.objectId,
          attachmentId: best.id,
          url,
          name: best.name ?? undefined,
          contentType: best.contentType ?? undefined,
          cameraHeading: leftExp.attrs?.cameraheading ?? leftExp.attrs?.cameraHeading ?? undefined,
          cameraPitch: leftExp.attrs?.camerapitch ?? leftExp.attrs?.cameraPitch ?? undefined,
          cameraRoll: leftExp.attrs?.cameraroll ?? leftExp.attrs?.cameraRoll ?? undefined,
          vfov: leftExp.attrs?.verticalfieldofview ?? leftExp.attrs?.vfov ?? undefined,
        });
        setStatus("ready");
      } catch {
        if (!cancelled) {
          setPanoLeft(null);
          setStatus("empty");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [leftExp?.layerUrl, leftExp?.objectId, leftExp, setPanoLeft, lastClickedPoint, candidateExposures.length]);

  // Datas marcadas no calendário (uma por candidato)
  const markedDates = useMemo(() => {
    return candidateExposures
      .map((c) => c.attrs?.acquisitiondate)
      .filter((v) => typeof v === "number" && Number.isFinite(v))
      .map((ms) => normalizeDay(new Date(ms)));
  }, [candidateExposures]);

  // Data selecionada atual
  const selectedDate = useMemo(() => {
    const ms = leftExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [leftExp]);

  // Troca de imagem ao clicar no calendário
  const onPickDate = (d: Date) => {
    const dd = normalizeDay(d);
    const found = candidateExposures.find((c) => {
      const ms = c.attrs?.acquisitiondate;
      if (typeof ms !== "number" || !Number.isFinite(ms)) return false;
      return sameDay(normalizeDay(new Date(ms)), dd);
    });
    if (found) setLeftExp(found);
  };


  function renderViewer() {
    switch (status) {
      case "waiting":
        return (
          <div className="sps__empty">
            <div className="sps__empty__card">
              <i className="fa-solid fa-map-location-dot sps__empty__icon" />
              <span>Clique em um ponto do mapa para visualizar a imagem 360</span>
            </div>
          </div>
        );
      case "loading":
        return (
          <div className="sps__empty">
            <div className="sps__empty__card">
              <i className="fa-solid fa-circle-notch fa-spin sps__empty__icon" />
              <span>Carregando imagem 360…</span>
            </div>
          </div>
        );
      case "empty":
        return (
          <div className="sps__empty">
            <div className="sps__empty__card">
              <i className="fa-solid fa-image-slash sps__empty__icon" />
              <span>Nenhuma imagem disponível para este ponto</span>
              <span className="sps__empty__sub">Tente selecionar outro ponto no mini-mapa</span>
              <button className="sps__close-btn" onClick={() => window.close()}>
                Fechar aba
              </button>
            </div>
          </div>
        );
      case "ready":
        return panoLeft?.url ? (
          <SinglePanoViewer
            url={panoLeft.url}
            heading={panoLeft.cameraHeading ?? null}
            pitch={panoLeft.cameraPitch ?? null}
            vfov={panoLeft.vfov ?? null}
          />
        ) : null;
    }
  }

  return (
    <div className="sps">
      {/* Viewer 360 ocupa todo o fundo */}
      <div className="sps__viewer">
        {renderViewer()}
      </div>

      {/* Calendário — canto superior esquerdo */}
      {markedDates.length > 0 && (
        <div className="sps__calendar">
          <div className="sps__calendarLabel">Datas disponíveis</div>
          <MarkedCalendar
            markedDates={markedDates}
            onPick={onPickDate}
            selectedDate={selectedDate}
          />
        </div>
      )}

      {/* Mini mapa — canto inferior esquerdo */}
      <div className="sps__minimap">
        <MiniMap360View defaultZoom={18} />
      </div>

      {/* HUD de Orientação Inicial — canto superior direito
      {panoLeft && (
        <div className="sps__orientation-info">
          <h4>Atributos da Imagem</h4>
          <div className="sps__orientation-row">
            <span className="sps__orientation-label">Heading:</span>
            <span className="sps__orientation-value">{panoLeft.cameraHeading?.toFixed(2) ?? "N/A"}°</span>
          </div>
          <div className="sps__orientation-row">
            <span className="sps__orientation-label">Pitch:</span>
            <span className="sps__orientation-value">{panoLeft.cameraPitch?.toFixed(2) ?? "N/A"}°</span>
          </div>
          <div className="sps__orientation-row">
            <span className="sps__orientation-label">Roll:</span>
            <span className="sps__orientation-value">{panoLeft.cameraRoll?.toFixed(2) ?? "N/A"}°</span>
          </div>
          <div className="sps__orientation-row">
            <span className="sps__orientation-label">VFOV:</span>
            <span className="sps__orientation-value">{panoLeft.vfov?.toFixed(2) ?? "N/A"}°</span>
          </div>
        </div>
      )} */}

      {/* Botão Comparar/Voltar — centro inferior, compartilhado */}
      <PanoToggleBtn />
    </div>
  );
}
