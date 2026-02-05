// src/modules/map/MapBase.tsx
import React, { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import { useAppStore } from "../../core/store";

export default function MapBase() {
    const divRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<MapView | null>(null);

    const setMapView = useAppStore((s) => s.setMapView);

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
                minZoom: 2,
                maxZoom: 22,
                rotationEnabled: true,
            },
        });


        viewRef.current = view;

        view.when(() => {
            setMapView(view);// ✅ chave: expõe view para Swipe/360
        });

        return () => {
            setMapView(null);
            view.destroy();
            viewRef.current = null;
        };
    }, [setMapView]);

    return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
