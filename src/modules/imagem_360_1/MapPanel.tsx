import React, { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";

import { useAppStore } from "../../core/store";

const EXPOSURE_LAYER_URL =
    "https://sig.dnit.gov.br/server/rest/services/Hosted/Imagens360/FeatureServer/0";

export default function MapPanel() {
    const divRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<MapView | null>(null);
    const exposureLayerRef = useRef<FeatureLayer | null>(null);

    const setSelectedExposure = useAppStore((s) => s.setSelectedExposure);

    useEffect(() => {
        if (!divRef.current) return;
        if (viewRef.current) return;

        const map = new Map({
            basemap: "hybrid",
        });

        const view = new MapView({
            container: divRef.current,
            map,
            center: [-47.8825, -15.7942],
            zoom: 5,
        });

        viewRef.current = view;

        let clickHandle: __esri.Handle | null = null;

        async function setup() {
            await view.when();
            if (!view.map) return;

            // 🔹 cria a layer 360 já na inicialização
            const layer = new FeatureLayer({
                url: EXPOSURE_LAYER_URL,
                outFields: ["*"],
            });

            view.map.add(layer);
            exposureLayerRef.current = layer;

            // 🔹 clique no ponto -> selectedExposure
            clickHandle = view.on("click", async (evt) => {
                const currentLayer = exposureLayerRef.current;
                if (!currentLayer) return;

                const hit = await view.hitTest(evt);
                if (!hit?.results?.length) return;

                const gHit = hit.results.find(
                    (r): r is __esri.MapViewGraphicHit =>
                        "graphic" in r &&
                        (r as __esri.MapViewGraphicHit).graphic.layer === currentLayer
                );

                const graphic = gHit?.graphic;
                if (!graphic?.attributes) return;

                const oidField = currentLayer.objectIdField || "OBJECTID";
                const objectId = graphic.attributes[oidField];
                if (objectId == null) return;

                setSelectedExposure({
                    objectId: Number(objectId),
                    layerUrl: EXPOSURE_LAYER_URL,
                    name: graphic.attributes.name ?? graphic.attributes.NOME ?? null,
                    acquisitionDate:
                        graphic.attributes.acquisitionDate ??
                        graphic.attributes.DATA ??
                        null,
                    cameraHeading:
                        graphic.attributes.cameraHeading ??
                        graphic.attributes.HEADING ??
                        null,
                });
            });
        }

        setup();

        return () => {
            clickHandle?.remove();
            exposureLayerRef.current = null;
            view.destroy();
            viewRef.current = null;
        };
    }, [setSelectedExposure]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
