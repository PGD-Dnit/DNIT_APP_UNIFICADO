// src/modules/imagem_360/ComparePage.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";

import ComparePanoScreen from "./ComparePanoScreen";

const SESSION_KEY_PREFIX = "dnit_360_payload:";

function parseExposure(search: string): ExposureRef | null {
    const q = new URLSearchParams(search);

    const layerUrl = q.get("layerUrl") || "";
    const objectId = Number(q.get("objectId") || "");
    const acq = q.get("acq");
    const acquisitionDate = acq ? Number(acq) : undefined;

    if (!layerUrl || !Number.isFinite(objectId)) return null;

    // OBS: aqui não tem attrs. Isso é ok; o ComparePanoScreen
    // vai conseguir renderizar pano (attachments) mesmo assim.
    return {
        layerUrl,
        objectId,
        acquisitionDate,
    } as ExposureRef;
}

export default function ComparePage() {
    const location = useLocation();

    const setSelectedExposureLeft = useAppStore((s) => s.setSelectedExposureLeft);
    const setSelectedExposureRight = useAppStore((s) => s.setSelectedExposureRight);
    const setCompareOpen = useAppStore((s) => s.setCompareOpen);

    // Hidratação via query string (ex.: link direto com ?layerUrl=...&objectId=...)
    useEffect(() => {
        const exp = parseExposure(location.search);
        if (!exp) return;

        // ✅ conforme seu requisito: duplicado
        setSelectedExposureLeft(exp);
        setSelectedExposureRight(exp);

        // se seu ComparePanoScreen usa isso pro botão "Voltar"
        setCompareOpen(true);
    }, [location.search, setSelectedExposureLeft, setSelectedExposureRight, setCompareOpen]);

    // Hidratação via postMessage — garante funcionamento quando a aba é aberta
    // diretamente em /compare sem store pré-hidratado (ex.: F5, link salvo)
    useEffect(() => {
        const targetOrigin = window.location.origin;
        const params = new URLSearchParams(window.location.search);
        const mid = params.get("mid");

        // ── 1. Rehidratação pós-F5: lê payload salvo em sessionStorage ──
        if (mid) {
            try {
                const cached = sessionStorage.getItem(SESSION_KEY_PREFIX + mid);
                if (cached) {
                    const data = JSON.parse(cached);
                    const store = useAppStore.getState();
                    if (data.lastClickedPoint) store.setLastClickedPoint(data.lastClickedPoint);
                    if (Array.isArray(data.candidates)) store.setCandidateExposures(data.candidates);
                    if (data.left) store.setSelectedExposureLeft(data.left);
                    if (data.right) store.setSelectedExposureRight(data.right);
                }
            } catch { }
        }

        // ── 2. Mantém sessionStorage atualizado enquanto o usuário navega no minimap ──
        // Sem isso, ao voltar para /view360 o SinglePanoPage leria o estado antigo
        // (ponto A) em vez do último ponto selecionado (ponto C).
        let unsubscribeStore: (() => void) | null = null;
        if (mid) {
            const midKey = mid;
            unsubscribeStore = useAppStore.subscribe((state, prev) => {
                if (
                    state.selectedExposureLeft  === prev.selectedExposureLeft &&
                    state.selectedExposureRight === prev.selectedExposureRight &&
                    state.candidateExposures    === prev.candidateExposures &&
                    state.lastClickedPoint      === prev.lastClickedPoint
                ) return;

                try {
                    const payload = {
                        __type: "DNIT_COMPARE_INIT",
                        msgId: midKey,
                        lastClickedPoint: state.lastClickedPoint,
                        candidates: state.candidateExposures,
                        left: state.selectedExposureLeft,
                        right: state.selectedExposureRight,
                    };
                    sessionStorage.setItem(SESSION_KEY_PREFIX + midKey, JSON.stringify(payload));
                } catch { }
            });
        }

        // ── 3. Listener de postMessage (primeira carga ou dados atualizados) ──
        const onMsg = (e: MessageEvent) => {
            if (e.origin !== targetOrigin) return;
            const data: any = e.data;
            if (!data || data.__type !== "DNIT_COMPARE_INIT") return;
            if (mid && data.msgId && data.msgId !== mid) return;

            // persiste para sobreviver ao F5
            try {
                if (data.msgId) {
                    sessionStorage.setItem(SESSION_KEY_PREFIX + data.msgId, JSON.stringify(data));
                }
            } catch { }

            const store = useAppStore.getState();
            if (data.lastClickedPoint) store.setLastClickedPoint(data.lastClickedPoint);
            if (Array.isArray(data.candidates)) store.setCandidateExposures(data.candidates);
            if (data.left) store.setSelectedExposureLeft(data.left);
            if (data.right) store.setSelectedExposureRight(data.right);

            try {
                window.opener?.postMessage(
                    { __type: "DNIT_COMPARE_ACK", msgId: data.msgId },
                    targetOrigin
                );
            } catch { }
        };

        window.addEventListener("message", onMsg);
        return () => {
            window.removeEventListener("message", onMsg);
            unsubscribeStore?.();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0f14" }}>
            <ComparePanoScreen />
        </div>
    );
}
