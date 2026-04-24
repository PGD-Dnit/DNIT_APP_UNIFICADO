// src/modules/imagem_360/SinglePanoPage.tsx
// Wrapper da rota /view360.
// Recebe o postMessage de Setup360OnView, hidrata o store e renderiza SinglePanoScreen.
import { useEffect } from "react";
import { useAppStore } from "../../core/store";
import SinglePanoScreen from "./SinglePanoScreen";

export default function SinglePanoPage() {
    const targetOrigin = window.location.origin;

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const mid = params.get("mid");

        const onMsg = (e: MessageEvent) => {
            if (e.origin !== targetOrigin) return;

            const data: any = e.data;
            if (!data || data.__type !== "DNIT_COMPARE_INIT") return;

            // aceita apenas o msgId correspondente a esta aba (se informado)
            if (mid && data.msgId && data.msgId !== mid) return;

            // hidrata store na nova aba
            const store = useAppStore.getState();
            if (data.lastClickedPoint) store.setLastClickedPoint(data.lastClickedPoint);
            if (Array.isArray(data.candidates)) store.setCandidateExposures(data.candidates);
            if (data.left) store.setSelectedExposureLeft(data.left);
            if (data.right) store.setSelectedExposureRight(data.right);

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
