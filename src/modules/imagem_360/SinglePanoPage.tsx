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
    const mid = new URLSearchParams(window.location.search).get("mid");

    useEffect(() => {
        // ── 1. Rehidratação pós-F5 ──
        // Lê o payload salvo em sessionStorage e restaura o store.
        // IMPORTANTE: só hidrata se o store estiver vazio (selectedExposureLeft == null),
        // pois ao voltar de /compare via navegação SPA o store já tem o último ponto
        // selecionado (ponto C) e não deve ser sobrescrito pelo cache antigo.
        if (mid) {
            try {
                const cached = sessionStorage.getItem(SESSION_KEY_PREFIX + mid);
                if (cached && !useAppStore.getState().selectedExposureLeft) {
                    hydrateStore(JSON.parse(cached));
                }
            } catch { }
        }

        // ── 2. Mantém sessionStorage sincronizado com o store (via Zustand subscribe) ──
        // Usamos useAppStore.subscribe() ao invés de useEffect+hooks para evitar:
        //   a) Race condition com React.StrictMode (double-invocation de effects)
        //   b) Closures stale com valores nulos sobrescrevendo o sessionStorage
        // O subscribe só dispara quando algo REALMENTE muda — nunca no estado inicial vazio.
        let unsubscribeStore: (() => void) | null = null;
        if (mid) {
            const midKey = mid; // captura estável para o closure
            unsubscribeStore = useAppStore.subscribe((state, prev) => {
                // ignora mudanças irrelevantes
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

        // ── 3. Listener de postMessage (primeira carga vinda da aba principal) ──
        const onMsg = (e: MessageEvent) => {
            if (e.origin !== targetOrigin) return;
            const data: any = e.data;
            if (!data || data.__type !== "DNIT_COMPARE_INIT") return;
            if (mid && data.msgId && data.msgId !== mid) return;

            // O subscribe do Zustand (passo 2) vai persistir automaticamente
            // quando o store for atualizado abaixo — não precisamos gravar aqui.
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
        return () => {
            window.removeEventListener("message", onMsg);
            unsubscribeStore?.();
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return (
        <div style={{ height: "100vh", width: "100vw", background: "#0b0f14" }}>
            <SinglePanoScreen />
        </div>
    );
}

