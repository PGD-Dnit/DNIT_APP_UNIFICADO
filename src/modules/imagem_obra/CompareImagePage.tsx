// src/modules/imagem_obra/CompareImagePage.tsx
import { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";

import CompareImageScreen from "./CompareImageScreen";

function parseExposure(search: string): ExposureRef | null {
    const q = new URLSearchParams(search);

    const layerUrl = q.get("layerUrl") || "";
    const objectId = Number(q.get("objectId") || "");
    const acq = q.get("acq");
    const acquisitionDate = acq ? Number(acq) : undefined;

    if (!layerUrl || !Number.isFinite(objectId)) return null;

    return {
        layerUrl,
        objectId,
        acquisitionDate,
    } as ExposureRef;
}

export default function CompareImagePage() {
    const location = useLocation();

    const setSelectedImageLeft = useAppStore((s) => s.setSelectedImageLeft);
    const setSelectedImageRight = useAppStore((s) => s.setSelectedImageRight);
    const setCompareImageOpen = useAppStore((s) => s.setCompareImageOpen);

    // Hidratação via query string (ex.: link direto com ?layerUrl=...&objectId=...)
    useEffect(() => {
        const exp = parseExposure(location.search);
        if (!exp) return;

        setSelectedImageLeft(exp);
        setSelectedImageRight(exp);
        setCompareImageOpen(true);
    }, [location.search, setSelectedImageLeft, setSelectedImageRight, setCompareImageOpen]);

    // Hidratação via postMessage — garante funcionamento quando a aba é aberta
    // diretamente em /compare-image sem store pré-hidratado (ex.: F5, link salvo)
    useEffect(() => {
        const targetOrigin = window.location.origin;
        const params = new URLSearchParams(window.location.search);
        const mid = params.get("mid");

        // ── 1. Rehidratação pós-F5: lê payload salvo em sessionStorage ──
        if (mid) {
            try {
                const cached = sessionStorage.getItem(`dnit_img_payload:${mid}`);
                if (cached) {
                    const data = JSON.parse(cached);
                    const store = useAppStore.getState();
                    if (data.lastClickedPoint) store.setLastClickedPoint(data.lastClickedPoint);
                    if (Array.isArray(data.candidates)) store.setCandidateImages(data.candidates);
                    if (data.left) store.setSelectedImageLeft(data.left);
                    if (data.right) store.setSelectedImageRight(data.right);
                }
            } catch { }
        }

        // ── 2. Listener de postMessage (primeira carga ou dados atualizados) ──
        const onMsg = (e: MessageEvent) => {
            if (e.origin !== targetOrigin) return;
            const data: any = e.data;
            if (!data || data.__type !== "DNIT_IMAGE_COMPARE_INIT") return;
            if (mid && data.msgId && data.msgId !== mid) return;

            // persiste para sobreviver ao F5
            try {
                if (data.msgId) {
                    sessionStorage.setItem(`dnit_img_payload:${data.msgId}`, JSON.stringify(data));
                }
            } catch { }

            const store = useAppStore.getState();
            if (data.lastClickedPoint) store.setLastClickedPoint(data.lastClickedPoint);
            if (Array.isArray(data.candidates)) store.setCandidateImages(data.candidates);
            if (data.left) store.setSelectedImageLeft(data.left);
            if (data.right) store.setSelectedImageRight(data.right);

            try {
                window.opener?.postMessage(
                    { __type: "DNIT_IMAGE_COMPARE_ACK", msgId: data.msgId },
                    targetOrigin
                );
            } catch { }
        };

        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0f14" }}>
            <CompareImageScreen />
        </div>
    );
}
