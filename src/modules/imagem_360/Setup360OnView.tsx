// src/modules/imagem_360/Setup360OnView.ts
import type MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Handles from "@arcgis/core/core/Handles";
import { useAppStore } from "../../core/store";

const LAYER_URL =
    "https://sig.dnit.gov.br/server/rest/services/Hosted/Imagens360_clayton/FeatureServer/0";

export function Setup360OnView(view: MapView) {
    const handles = new Handles();

    // garante layer no mapa (sem duplicar)
    let layer = view.map.findLayerById("imagens360") as FeatureLayer | null;

    if (!layer) {
        layer = new FeatureLayer({
            url: LAYER_URL,
            id: "imagens360",
            outFields: ["*"],
        });
        view.map.add(layer);
    }

    handles.add(
        view.on("click", async (ev) => {
            const {
                setLastClickedPoint,
                setCandidateExposures,
                setSelectedExposureLeft,
                setSelectedExposureRight,
            } = useAppStore.getState();

            if (!ev.mapPoint) return;

            // ✅ guarda o ponto do clique (para o minimapa / contexto)
            setLastClickedPoint({
                x: ev.mapPoint.x,
                y: ev.mapPoint.y,
                wkid: ev.mapPoint.spatialReference?.wkid,
            });

            // hitTest somente na layer 360
            const hit = await view.hitTest(ev, { include: [layer!] });
            const g = hit.results[0]?.graphic;
            if (!g?.attributes) return;

            // pega OBJECTID do jeito certo
            const oidField = layer!.objectIdField;
            const objectId = g.attributes?.[oidField];
            if (!objectId) return;

            const ref = {
                objectId,
                layerUrl: LAYER_URL,
                title: g.attributes?.name ?? "Imagem 360",
                attrs: g.attributes,
                acquisitionDate: g.attributes?.acquisitionDate,
            };

            // ✅ alimenta store
            setCandidateExposures([ref]);
            setSelectedExposureLeft(ref);
            setSelectedExposureRight(ref); // ✅ duplicado como você quer

            // ✅ passa pela URL (recomendado)
            const qs = new URLSearchParams({
                layerUrl: ref.layerUrl,
                objectId: String(ref.objectId),
                acq: ref.acquisitionDate ? String(ref.acquisitionDate) : "",
            }).toString();

            // ✅ fallback (opcional) via sessionStorage
            // útil se a aba /compare quiser iniciar mesmo sem ler a query por algum motivo
            try {
                sessionStorage.setItem(
                    "compareInit",
                    JSON.stringify({ left: ref, right: ref })
                );
            } catch {
                // se storage falhar, segue sem bloquear
            }

            // ===== Abra a nova aba =====

            // ✅ BrowserRouter (rota normal):
            window.open(`/compare?${qs}`, "_blank", "noopener,noreferrer");

            // ✅ HashRouter (se seu app usa /#/):
            // window.open(`/#/compare?${qs}`, "_blank", "noopener,noreferrer");
        })
    );

    return () => {
        handles.removeAll();
        handles.destroy();
    };
}
