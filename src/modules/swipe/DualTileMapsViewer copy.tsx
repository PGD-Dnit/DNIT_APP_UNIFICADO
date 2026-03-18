import { useEffect, useRef } from "react";

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Viewpoint from "@arcgis/core/Viewpoint";

type Props = {
    leftTileUrl: string;
    rightTileUrl: string;
    titleLeft?: string;
    titleRight?: string;
    initialViewpoint?: Viewpoint;
    onViewsReady?: (p: { leftView: MapView; rightView: MapView }) => void;
};

export default function DualTileMapsViewer({
    leftTileUrl,
    rightTileUrl,
    titleLeft,
    titleRight,
    initialViewpoint,
    onViewsReady,
}: Props) {
    const leftDiv = useRef<HTMLDivElement | null>(null);
    const rightDiv = useRef<HTMLDivElement | null>(null);

    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    useEffect(() => {
        if (!leftDiv.current || !rightDiv.current) return;

        const leftLayer = new WebTileLayer({
            urlTemplate: leftTileUrl,
        });

        const rightLayer = new WebTileLayer({
            urlTemplate: rightTileUrl,
        });

        const leftMap = new Map({ layers: [leftLayer] });
        const rightMap = new Map({ layers: [rightLayer] });

        const leftView = new MapView({
            container: leftDiv.current,
            map: leftMap,
            ui: { components: ["zoom", "compass", "attribution"] },
        });

        const rightView = new MapView({
            container: rightDiv.current,
            map: rightMap,
            ui: { components: ["zoom", "compass", "attribution"] },
        });

        leftViewRef.current = leftView;
        rightViewRef.current = rightView;

        const applyInitial = async () => {
            await Promise.all([leftView.when(), rightView.when()]);

            if (initialViewpoint) {
                // ✅ começam iguais, depois ficam independentes
                leftView.viewpoint = initialViewpoint.clone();
                rightView.viewpoint = initialViewpoint.clone();
            }

            onViewsReady?.({ leftView, rightView });
        };

        applyInitial();

        return () => {
            leftViewRef.current?.destroy();
            rightViewRef.current?.destroy();
            leftViewRef.current = null;
            rightViewRef.current = null;
        };
    }, [leftTileUrl, rightTileUrl]); // se trocar mosaico, recria mapas

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            {/* títulos */}
            <div
                style={{
                    position: "absolute",
                    zIndex: 60,
                    top: 10,
                    left: 10,
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,.9)",
                    border: "1px solid rgba(0,0,0,.12)",
                    pointerEvents: "none",
                }}
            >
                {titleLeft || "Esquerda"}
            </div>

            <div
                style={{
                    position: "absolute",
                    zIndex: 60,
                    top: 10,
                    right: 10,
                    padding: "4px 8px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,.9)",
                    border: "1px solid rgba(0,0,0,.12)",
                    pointerEvents: "none",
                }}
            >
                {titleRight || "Direita"}
            </div>

            {/* 2 mapas */}
            <div style={{ display: "flex", width: "100%", height: "100%" }}>
                <div style={{ flex: 1, position: "relative" }}>
                    <div ref={leftDiv} style={{ width: "100%", height: "100%" }} />
                </div>

                <div style={{ width: 2, background: "rgba(0,0,0,.18)" }} />

                <div style={{ flex: 1, position: "relative" }}>
                    <div ref={rightDiv} style={{ width: "100%", height: "100%" }} />
                </div>
            </div>
        </div>
    );
}