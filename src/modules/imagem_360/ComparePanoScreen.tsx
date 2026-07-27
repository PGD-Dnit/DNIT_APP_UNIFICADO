import { useEffect, useMemo } from "react";

import { useAppStore } from "../../core/store";
import DualPanoViewer from "./DualPanoViewer";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import MiniMap360View from "./MiniMap360View";
import PanoToggleBtn from "./PanoToggleBtn";


import "./ComparePanoScreen.css";

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

export default function ComparePanoScreen() {

  const candidateExposures = useAppStore((s) => s.candidateExposures);

  const leftExp = useAppStore((s) => s.selectedExposureLeft);
  const rightExp = useAppStore((s) => s.selectedExposureRight);

  const setLeftExp = useAppStore((s) => s.setSelectedExposureLeft);
  const setRightExp = useAppStore((s) => s.setSelectedExposureRight);

  const panoLeft = useAppStore((s) => s.panoLeft);
  const panoRight = useAppStore((s) => s.panoRight);

  const setPanoLeft = useAppStore((s) => s.setPanoLeft);
  const setPanoRight = useAppStore((s) => s.setPanoRight);

  useEffect(() => {
    const targetOrigin = window.location.origin;
    const params = new URLSearchParams(window.location.search);
    const mid = params.get("mid"); // opcional, usado só para debug/ack

    const onMsg = (e: MessageEvent) => {
      if (e.origin !== targetOrigin) return;

      const data: any = e.data;
      if (!data || data.__type !== "DNIT_COMPARE_INIT") return;

      // se você quiser garantir que só aceita o mid desta aba:
      if (mid && data.msgId && data.msgId !== mid) return;

      // hidrata store
      if (data.lastClickedPoint) useAppStore.getState().setLastClickedPoint(data.lastClickedPoint);
      if (Array.isArray(data.candidates)) useAppStore.getState().setCandidateExposures(data.candidates);
      if (data.left) useAppStore.getState().setSelectedExposureLeft(data.left);
      if (data.right) useAppStore.getState().setSelectedExposureRight(data.right);

      // ACK para a aba origem parar o retry
      try {
        window.opener?.postMessage({ __type: "DNIT_COMPARE_ACK", msgId: data.msgId }, targetOrigin);
      } catch { }
    };

    window.addEventListener("message", onMsg);
    return () => window.removeEventListener("message", onMsg);
  }, []);


  const markedDates = useMemo(() => {
    return candidateExposures
      .map((c) => c.attrs?.acquisitiondate)
      .filter((v) => typeof v === "number" && Number.isFinite(v))
      .map((ms) => normalizeDay(new Date(ms)));
  }, [candidateExposures]);

  const leftSelectedDate = useMemo(() => {
    const ms = leftExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [leftExp]);

  const rightSelectedDate = useMemo(() => {
    const ms = rightExp?.attrs?.acquisitiondate;
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    return normalizeDay(new Date(ms));
  }, [rightExp]);

  const findExposureByDay = (d: Date) => {
    const dd = normalizeDay(d);
    return (
      candidateExposures.find((c) => {
        const ms = c.attrs?.acquisitiondate;
        if (typeof ms !== "number" || !Number.isFinite(ms)) return false;
        return sameDay(normalizeDay(new Date(ms)), dd);
      }) ?? null
    );
  };

  // ── Carrega LEFT e RIGHT em paralelo, atualizando ambos ao mesmo tempo ──
  // Um único efeito com Promise.all evita o estado intermediário onde
  // panoLeft já tem a nova URL mas panoRight ainda tem a URL antiga,
  // o que causava o DualPanoViewer renderizar com imagens misturadas.
  useEffect(() => {
    let cancelled = false;

    // Limpa imediatamente ao trocar de exposição para não exibir par antigo
    setPanoLeft(null);
    setPanoRight(null);

    if (!leftExp && !rightExp) return;

    const loadPano = async (exp: typeof leftExp) => {
      if (!exp) return null;
      const list = await listAttachments(exp.layerUrl, exp.objectId);
      const best = pickBest(list);
      if (!best) return null;
      const url = buildAttachmentUrl(exp.layerUrl, exp.objectId, best.id);
      return {
        objectId: exp.objectId,
        attachmentId: best.id,
        url,
        name: best.name ?? undefined,
        contentType: best.contentType ?? undefined,
        cameraHeading: exp.attrs?.cameraheading ?? exp.attrs?.cameraHeading ?? undefined,
        cameraPitch: exp.attrs?.camerapitch ?? exp.attrs?.cameraPitch ?? undefined,
        cameraRoll: exp.attrs?.cameraroll ?? exp.attrs?.cameraRoll ?? undefined,
        vfov: exp.attrs?.verticalfieldofview ?? exp.attrs?.vfov ?? undefined,
      };
    };

    (async () => {
      try {
        // Carrega ambos em paralelo — só atualiza o store quando os dois terminarem
        const [left, right] = await Promise.all([
          loadPano(leftExp),
          loadPano(rightExp),
        ]);
        if (cancelled) return;
        // Atualização atômica: ambos os lados recebem a nova imagem juntos
        setPanoLeft(left);
        setPanoRight(right);
      } catch {
        if (!cancelled) {
          setPanoLeft(null);
          setPanoRight(null);
        }
      }
    })();

    return () => { cancelled = true; };
  }, [
    leftExp?.layerUrl, leftExp?.objectId,
    rightExp?.layerUrl, rightExp?.objectId,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    setPanoLeft, setPanoRight,
  ]);

  const onPickLeft = (d: Date) => {
    const found = findExposureByDay(d);
    if (found) setLeftExp(found);
  };

  const onPickRight = (d: Date) => {
    const found = findExposureByDay(d);
    if (found) setRightExp(found);
  };

  return (
    <div className="cps">
      <div className="cps__stage">
        {/* calendário ESQ */}
        <div className="cps__overlay cps__overlay--left">
          <div className="cps__overlayTitle"></div>
          <MarkedCalendar
            markedDates={markedDates}
            onPick={onPickLeft}
            selectedDate={leftSelectedDate}
          />
        </div>

        {/* calendário DIR */}
        <div className="cps__overlay cps__overlay--right">
          <div className="cps__overlayTitle"></div>
          <MarkedCalendar
            markedDates={markedDates}
            onPick={onPickRight}
            selectedDate={rightSelectedDate}
          />
        </div>

        {/* mini map */}
        <div className="cps__minimapWrap">
          <MiniMap360View defaultZoom={18} />
        </div>

        {/* Botão Comparar/Voltar — centro inferior, compartilhado */}
        <PanoToggleBtn />

        <DualPanoViewer
          leftUrl={panoLeft?.url ?? ""}
          rightUrl={panoRight?.url ?? ""}
          leftHeading={panoLeft?.cameraHeading ?? null}
          leftPitch={panoLeft?.cameraPitch ?? null}
          leftVfov={panoLeft?.vfov ?? null}
          rightHeading={panoRight?.cameraHeading ?? null}
          rightPitch={panoRight?.cameraPitch ?? null}
          rightVfov={panoRight?.vfov ?? null}
        />
      </div>
    </div>
  );
}
