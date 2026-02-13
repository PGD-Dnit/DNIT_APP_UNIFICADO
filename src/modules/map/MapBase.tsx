import React, { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Extent from "@arcgis/core/geometry/Extent";


// ✅ Widgets
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";

import { useAppStore } from "../../core/store";
import { CONFIG } from "../../core/config";

export default function MapBase() {
    const divRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<MapView | null>(null);
    const planetLayerRef = useRef<WebTileLayer | null>(null);

    // ✅ refs p/ widgets (pra destruir no cleanup)
    const searchRef = useRef<Search | null>(null);
    const compassRef = useRef<Compass | null>(null);

    const setMapView = useAppStore((s) => s.setMapView);

    const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);
    const planetSelectedId = useAppStore((s) => s.planetSelectedId);
    const planetMosaics = useAppStore((s) => s.planetMosaics);

    /* 1️⃣ Cria MapView e carrega mosaics (1x) */
    useEffect(() => {
        if (!divRef.current) return;
        if (viewRef.current) return;

        const map = new Map({ basemap: "hybrid" });

        const view = new MapView({
            container: divRef.current,
            map,
            center: [-53, -15.8],
            zoom: 4,
            extent: {
                xmin: -75,
                ymin: -35,
                xmax: -30,
                ymax: 10,
                spatialReference: { wkid: 4326 },
            },
            constraints: {
                snapToZoom: false,
                minZoom: 4,
                maxZoom: 22,
                rotationEnabled: true,
                geometry: {
                    type: "extent",
                    xmin: -75,
                    ymin: -35,
                    xmax: -30,
                    ymax: 10,
                    spatialReference: { wkid: 4326 },
                },
            },
        });

        viewRef.current = view;

        view.when(() => {
            setMapView(view);
            loadPlanetMosaics();

            // 🔎 FIND / SEARCH
            const search = new Search({
                view,
                includeDefaultSources: true,
                locationEnabled: true,
                popupEnabled: true,
                resultGraphicEnabled: true,
            });
            view.ui.add(search, { position: "top-right", index: 0 });
            searchRef.current = search;

            // 🧭 BÚSSOLA (mostra e reseta rotação)
            const compass = new Compass({ view });
            view.ui.add(compass, { position: "top-right", index: 1 });
            compassRef.current = compass;
        });

        return () => {
            // remove/destroi widgets antes de destruir o view
            try {
                if (searchRef.current) {
                    view.ui.remove(searchRef.current);
                    searchRef.current.destroy();
                    searchRef.current = null;
                }
                if (compassRef.current) {
                    view.ui.remove(compassRef.current);
                    compassRef.current.destroy();
                    compassRef.current = null;
                }
            } catch { }

            setMapView(null);
            view.destroy();
            viewRef.current = null;
            planetLayerRef.current = null;
        };
    }, [setMapView, loadPlanetMosaics]);

    /* 2️⃣ Aplica / atualiza camada Planet quando mudar o mosaico */
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        if (!planetSelectedId) return;

        const chosen = planetMosaics.find((m) => m.id === planetSelectedId);
        const title = chosen?.label || `Planet ${planetSelectedId}`;

        // remove camada anterior
        if (planetLayerRef.current) {
            view.map?.remove(planetLayerRef.current);
            planetLayerRef.current.destroy?.();
            planetLayerRef.current = null;
        }

        const urlTemplate = `${CONFIG.API_BASE}/planet/tiles/{level}/{col}/{row}.png?mosaic=${planetSelectedId}`;

        const layer = new WebTileLayer({
            urlTemplate,
            title,
            opacity: 0.85,
        });

        view.map?.add(layer);
        planetLayerRef.current = layer;
    }, [planetSelectedId, planetMosaics]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
