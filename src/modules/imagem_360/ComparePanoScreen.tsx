import React, { useEffect, useMemo } from "react";
import { useAppStore } from "../../core/store";
import DualPanoViewer from "./DualPanoViewer";
import { MarkedCalendar } from "./MarkedCalendar";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import MiniMap360View from "./MiniMap360View";

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
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);

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

  // LEFT pano
  useEffect(() => {
    (async () => {
      if (!leftExp) {
        setPanoLeft(null);
        return;
      }
      const list = await listAttachments(leftExp.layerUrl, leftExp.objectId);
      const best = pickBest(list);
      if (!best) {
        setPanoLeft(null);
        return;
      }
      const url = buildAttachmentUrl(leftExp.layerUrl, leftExp.objectId, best.id);

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
    })().catch(() => setPanoLeft(null));
  }, [leftExp?.layerUrl, leftExp?.objectId, leftExp, setPanoLeft]);

  // RIGHT pano
  useEffect(() => {
    (async () => {
      if (!rightExp) {
        setPanoRight(null);
        return;
      }
      const list = await listAttachments(rightExp.layerUrl, rightExp.objectId);
      const best = pickBest(list);
      if (!best) {
        setPanoRight(null);
        return;
      }
      const url = buildAttachmentUrl(rightExp.layerUrl, rightExp.objectId, best.id);

      setPanoRight({
        objectId: rightExp.objectId,
        attachmentId: best.id,
        url,
        name: best.name ?? undefined,
        contentType: best.contentType ?? undefined,
        cameraHeading: rightExp.attrs?.cameraheading ?? rightExp.attrs?.cameraHeading ?? undefined,
        cameraPitch: rightExp.attrs?.camerapitch ?? rightExp.attrs?.cameraPitch ?? undefined,
        cameraRoll: rightExp.attrs?.cameraroll ?? rightExp.attrs?.cameraRoll ?? undefined,
        vfov: rightExp.attrs?.verticalfieldofview ?? rightExp.attrs?.vfov ?? undefined,
      });
    })().catch(() => setPanoRight(null));
  }, [rightExp?.layerUrl, rightExp?.objectId, rightExp, setPanoRight]);

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
      <div className="cps__header">
        {/* <button type="button" className="cps__backBtn" onClick={() => setCompareOpen(false)}>
          ⬅ Voltar
        </button>

        <div className="cps__title">Comparação 360</div>

        <div className="cps__headerMeta">
          Sobrepostos: <b>{candidateExposures.length}</b>
        </div> */}
      </div>

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
