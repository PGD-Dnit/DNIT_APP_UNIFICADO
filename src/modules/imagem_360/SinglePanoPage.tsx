// src/modules/imagem_360/SinglePanoPage.tsx
// Wrapper da rota /view360.
// Recebe o postMessage de Setup360OnView, hidrata o store e renderiza SinglePanoScreen.
import { useEffect } from "react";
import { useAppStore } from "../../core/store";
import SinglePanoScreen from "./SinglePanoScreen";

const SESSION_KEY_PREFIX = "dnit_360_payload:";

function hydrateStore(data: any) {
    const store = useAppStore.getState();
    store.setLastClickedPoint(data.lastClickedPoint ?? null);
    store.setCandidateExposures(data.candidates ?? []);
    store.setSelectedExposureLeft(data.left ?? null);
    store.setSelectedExposureRight(data.right ?? null);
}

export default function SinglePanoPage() {
    const targetOrigin = window.location.origin;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mid = params.get("mid");

        // ── 1. Rehidratação pós-F5: lê payload salvo em sessionStorage ──
        if (mid) {
            try {
                const cached = sessionStorage.getItem(SESSION_KEY_PREFIX + mid);
                if (cached) {
                    hydrateStore(JSON.parse(cached));
                }
            } catch { }
        }

        // ── 2. Listener de postMessage (primeira carga ou dados atualizados) ──
        const onMsg = (e: MessageEvent) => {
            if (e.origin !== targetOrigin) return;

            const data: any = e.data;
            if (!data || data.__type !== "DNIT_COMPARE_INIT") return;

            // aceita apenas o msgId correspondente a esta aba (se informado)
            if (mid && data.msgId && data.msgId !== mid) return;

            // persiste para sobreviver ao F5
            try {
                if (data.msgId) {
                    sessionStorage.setItem(SESSION_KEY_PREFIX + data.msgId, JSON.stringify(data));
                }
            } catch { }

            hydrateStore(data);

            // ACK para a aba origem parar o retry
            try {
                window.opener?.postMessage(
                    { __type: "DNIT_COMPARE_ACK", msgId: data.msgId },
                    targetOrigin
                );
            } catch { }
        };

        window.addEventListener("message", onMsg);
        return () => window.removeEventListener("message", onMsg);
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0f14" }}>
            <SinglePanoScreen />
        </div>
    );
}
