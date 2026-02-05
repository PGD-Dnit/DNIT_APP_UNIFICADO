// src/modules/imagem_360/ComparePage.tsx
import React, { useEffect } from "react";
import { useLocation } from "react-router-dom";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";

import ComparePanoScreen from "./ComparePanoScreen";

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

    useEffect(() => {
        const exp = parseExposure(location.search);
        if (!exp) return;

        // ✅ conforme seu requisito: duplicado
        setSelectedExposureLeft(exp);
        setSelectedExposureRight(exp);

        // se seu ComparePanoScreen usa isso pro botão "Voltar"
        setCompareOpen(true);
    }, [location.search, setSelectedExposureLeft, setSelectedExposureRight, setCompareOpen]);

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0f14" }}>
            <ComparePanoScreen />
        </div>
    );
}
