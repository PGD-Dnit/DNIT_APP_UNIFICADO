import { useEffect, useRef } from "react";

import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Viewpoint from "@arcgis/core/Viewpoint";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

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
                leftView.viewpoint = initialViewpoint.clone();
                rightView.viewpoint = initialViewpoint.clone();
            }

            // --- Sincronização entre os dois mapas ---
            let isSyncing = false;
            const syncViews = (source: MapView, target: MapView) => {
                if (isSyncing || !source.viewpoint || !target.viewpoint) return;
                isSyncing = true;
                target.viewpoint = source.viewpoint.clone();

                requestAnimationFrame(() => {
                    isSyncing = false;
                });
            };

            const watch1 = reactiveUtils.watch(
                () => leftView.viewpoint,
                () => syncViews(leftView, rightView)
            );

            const watch2 = reactiveUtils.watch(
                () => rightView.viewpoint,
                () => syncViews(rightView, leftView)
            );

            // Armazena na view para poder remover depois
            (leftView as any)._syncWatch = watch1;
            (rightView as any)._syncWatch = watch2;

            onViewsReady?.({ leftView, rightView });
        };

        applyInitial();

        return () => {
            if (leftViewRef.current) {
                const w = (leftViewRef.current as any)._syncWatch;
                if (w) w.remove();
                leftViewRef.current.destroy();
            }
            if (rightViewRef.current) {
                const w = (rightViewRef.current as any)._syncWatch;
                if (w) w.remove();
                rightViewRef.current.destroy();
            }
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