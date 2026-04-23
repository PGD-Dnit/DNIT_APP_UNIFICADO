import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

import MosaicCalendar from "./MosaicCalendar";

import "./DualTileMapsViewer.css";
import "./TileSwipeViewer.css";

interface Props {
    leftTileUrl: string;
    rightTileUrl: string;
    titleLeft?: string;
    titleRight?: string;
    mosaics?: any[];
    initialViewpoint?: __esri.Viewpoint;
    droneDates?: Set<string>;
    onDroneDateClick?: (side: "left" | "right", dayKey: string) => void;
    onMosaicChange?: (side: "left" | "right", mosaicId: string) => void;
    onViewsReady?: (views: {
        leftView: __esri.MapView;
        rightView: __esri.MapView;
    }) => void;
}

export default function DualTileMapsViewer({
    leftTileUrl,
    rightTileUrl,
    titleLeft = "Mapa Esquerdo",
    titleRight = "Mapa Direito",
    mosaics = [],
    initialViewpoint,
    droneDates,
    onDroneDateClick,
    onMosaicChange,
    onViewsReady,
}: Props) {
    const leftDivRef = useRef<HTMLDivElement>(null);
    const rightDivRef = useRef<HTMLDivElement>(null);

    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    const leftLayerRef = useRef<WebTileLayer | null>(null);
    const rightLayerRef = useRef<WebTileLayer | null>(null);

    const syncingRef = useRef(false);
    const cleanupHandlesRef = useRef<(() => void)[]>([]);

    const onViewsReadyRef = useRef<typeof onViewsReady>(onViewsReady);

    const [showLeftCalendar, setShowLeftCalendar] = useState(false);
    const [showRightCalendar, setShowRightCalendar] = useState(false);

    const [currentLeft, setCurrentLeft] = useState(leftTileUrl);
    const [currentRight, setCurrentRight] = useState(rightTileUrl);

    const [labelLeft, setLabelLeft] = useState(titleLeft);
    const [labelRight, setLabelRight] = useState(titleRight);

    const [selectedLeft, setSelectedLeft] = useState<{
        year: number;
        month: number;
        day?: number;
    } | null>(null);

    const [selectedRight, setSelectedRight] = useState<{
        year: number;
        month: number;
        day?: number;
    } | null>(null);

    useEffect(() => {
        onViewsReadyRef.current = onViewsReady;
    }, [onViewsReady]);

    useEffect(() => {
        setCurrentLeft(leftTileUrl);
    }, [leftTileUrl]);

    useEffect(() => {
        setCurrentRight(rightTileUrl);
    }, [rightTileUrl]);

    useEffect(() => {
        setLabelLeft(titleLeft);
    }, [titleLeft]);

    useEffect(() => {
        setLabelRight(titleRight);
    }, [titleRight]);

    // cria as views uma única vez
    useEffect(() => {
        if (!leftDivRef.current || !rightDivRef.current) return;

        const leftMap = new Map({ basemap: "hybrid" });
        const rightMap = new Map({ basemap: "hybrid" });

        const defaultViewProps = initialViewpoint
            ? { viewpoint: initialViewpoint }
            : {
                center: [-53, -15.8],
                zoom: 4,
                extent: {
                    xmin: -75,
                    ymin: -35,
                    xmax: -30,
                    ymax: 10,
                    spatialReference: { wkid: 4326 },
                },
            };

        const leftView = new MapView({
            container: leftDivRef.current,
            map: leftMap,
            ...defaultViewProps,
            constraints: {
                snapToZoom: false,
                minZoom: 4,
                maxZoom: 22,
                rotationEnabled: true,
            },
        });

        const rightView = new MapView({
            container: rightDivRef.current,
            map: rightMap,
            ...defaultViewProps,
            constraints: {
                snapToZoom: false,
                minZoom: 4,
                maxZoom: 22,
                rotationEnabled: true,
            },
        });

        leftViewRef.current = leftView;
        rightViewRef.current = rightView;

        const leftSearch = new Search({ view: leftView });
        const rightSearch = new Search({ view: rightView });

        const leftCompass = new Compass({ view: leftView });
        const rightCompass = new Compass({ view: rightView });

        leftView.ui.add(leftSearch, { position: "top-right" });
        leftView.ui.add(leftCompass, { position: "top-left" });

        rightView.ui.add(rightSearch, { position: "top-right" });
        rightView.ui.add(rightCompass, { position: "top-left" });

        let destroyed = false;

        Promise.all([leftView.when(), rightView.when()])
            .then(() => {
                if (destroyed) return;

                // sincronismo bidirecional
                const syncFromLeft = reactiveUtils.watch(
                    () => [leftView.center?.x, leftView.center?.y, leftView.zoom, leftView.rotation],
                    () => {
                        if (syncingRef.current) return;
                        if (!leftView.ready || !rightView.ready) return;
                        if (leftView.interacting || leftView.animation) {
                            syncingRef.current = true;
                            rightView
                                .goTo(
                                    {
                                        center: leftView.center,
                                        zoom: leftView.zoom,
                                        rotation: leftView.rotation,
                                    },
                                    { animate: false }
                                )
                                .catch(() => { })
                                .finally(() => {
                                    syncingRef.current = false;
                                });
                        }
                    }
                );

                const syncFromRight = reactiveUtils.watch(
                    () => [rightView.center?.x, rightView.center?.y, rightView.zoom, rightView.rotation],
                    () => {
                        if (syncingRef.current) return;
                        if (!leftView.ready || !rightView.ready) return;
                        if (rightView.interacting || rightView.animation) {
                            syncingRef.current = true;
                            leftView
                                .goTo(
                                    {
                                        center: rightView.center,
                                        zoom: rightView.zoom,
                                        rotation: rightView.rotation,
                                    },
                                    { animate: false }
                                )
                                .catch(() => { })
                                .finally(() => {
                                    syncingRef.current = false;
                                });
                        }
                    }
                );

                cleanupHandlesRef.current.push(() => syncFromLeft.remove());
                cleanupHandlesRef.current.push(() => syncFromRight.remove());

                onViewsReadyRef.current?.({
                    leftView,
                    rightView,
                });
            })
            .catch((err) => {
                console.error("Erro ao iniciar DualTileMapsViewer:", err);
            });

        return () => {
            destroyed = true;

            cleanupHandlesRef.current.forEach((fn) => {
                try {
                    fn();
                } catch { }
            });
            cleanupHandlesRef.current = [];

            try {
                if (leftLayerRef.current) {
                    leftMap.remove(leftLayerRef.current);
                    leftLayerRef.current.destroy();
                    leftLayerRef.current = null;
                }
            } catch { }

            try {
                if (rightLayerRef.current) {
                    rightMap.remove(rightLayerRef.current);
                    rightLayerRef.current.destroy();
                    rightLayerRef.current = null;
                }
            } catch { }

            try {
                leftView.destroy();
            } catch { }

            try {
                rightView.destroy();
            } catch { }

            leftViewRef.current = null;
            rightViewRef.current = null;
        };
    }, []);

    // atualiza a layer da esquerda sem recriar a view
    useEffect(() => {
        const leftView = leftViewRef.current;
        if (!leftView || !leftView.map) return;

        const map = leftView.map;

        try {
            if (leftLayerRef.current) {
                map.remove(leftLayerRef.current);
                leftLayerRef.current.destroy();
                leftLayerRef.current = null;
            }
        } catch (err) {
            console.warn("Falha ao remover layer esquerda:", err);
        }

        const leftLayer = new WebTileLayer({
            urlTemplate: currentLeft,
            id: "dual-left-mosaic-layer",
        });

        leftLayerRef.current = leftLayer;
        // Inserir na posição 0 (base) para não cobrir as camadas drone (map-image-*)
        map.add(leftLayer, 0);
    }, [currentLeft]);

    // atualiza a layer da direita sem recriar a view
    useEffect(() => {
        const rightView = rightViewRef.current;
        if (!rightView || !rightView.map) return;

        const map = rightView.map;

        try {
            if (rightLayerRef.current) {
                map.remove(rightLayerRef.current);
                rightLayerRef.current.destroy();
                rightLayerRef.current = null;
            }
        } catch (err) {
            console.warn("Falha ao remover layer direita:", err);
        }

        const rightLayer = new WebTileLayer({
            urlTemplate: currentRight,
            id: "dual-right-mosaic-layer",
        });

        rightLayerRef.current = rightLayer;
        // Inserir na posição 0 (base) para não cobrir as camadas drone (map-image-*)
        map.add(rightLayer, 0);
    }, [currentRight]);

    const handleSelectLeft = (mosaic: any) => {
        if (!mosaic?.id) return;

        const nextUrl = `${window.location.origin}/consumeapi/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaic.id}`;
        setCurrentLeft(nextUrl);

        const raw = mosaic.date || mosaic.when || mosaic.label || "";
        const hit3 = String(raw).match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
        const hit2 = String(raw).match(/(\d{4})[-_/\.](\d{2})/);

        if (hit3) {
            setSelectedLeft({
                year: parseInt(hit3[1], 10),
                month: parseInt(hit3[2], 10),
                day: parseInt(hit3[3], 10),
            });
            setLabelLeft(`${hit3[3]}/${hit3[2]}/${hit3[1]}`);
        } else if (hit2) {
            const y = parseInt(hit2[1], 10);
            const mo = parseInt(hit2[2], 10);
            const endD = new Date(y, mo, 0).getDate();
            setSelectedLeft({ year: y, month: mo, day: endD });
            setLabelLeft(`${String(endD).padStart(2, "0")}/${hit2[2]}/${hit2[1]}`);
        }

        onMosaicChange?.("left", mosaic.id);
    };

    const handleSelectRight = (mosaic: any) => {
        if (!mosaic?.id) return;

        const nextUrl = `${window.location.origin}/consumeapi/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaic.id}`;
        setCurrentRight(nextUrl);

        const raw = mosaic.date || mosaic.when || mosaic.label || "";
        const hit3 = String(raw).match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
        const hit2 = String(raw).match(/(\d{4})[-_/\.](\d{2})/);

        if (hit3) {
            setSelectedRight({
                year: parseInt(hit3[1], 10),
                month: parseInt(hit3[2], 10),
                day: parseInt(hit3[3], 10),
            });
            setLabelRight(`${hit3[3]}/${hit3[2]}/${hit3[1]}`);
        } else if (hit2) {
            const y = parseInt(hit2[1], 10);
            const mo = parseInt(hit2[2], 10);
            const endD = new Date(y, mo, 0).getDate();
            setSelectedRight({ year: y, month: mo, day: endD });
            setLabelRight(`${String(endD).padStart(2, "0")}/${hit2[2]}/${hit2[1]}`);
        }

        onMosaicChange?.("right", mosaic.id);
    };

    return (
        <div className="dual-maps-page">
            <div className="dual-map-wrapper">
                <div ref={leftDivRef} className="dual-map" />

                <div className="calendario-botao-esquerdo" style={{ left: "50%" }}>
                    <button
                        onClick={() => setShowLeftCalendar((v) => !v)}
                        title="Abrir calendário esquerdo"
                    >
                        🗓️
                    </button>
                    <span>{labelLeft}</span>
                </div>

                {showLeftCalendar && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 95,
                            left: "49%",
                            transform: "translateX(-50%)",
                            background: "var(--panel, #fff)",
                            borderRadius: 12,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                            zIndex: 3000,
                            width: "180px",
                            minWidth: "180px",
                        }}
                    >
                        <MosaicCalendar
                            mosaics={mosaics}
                            title="Calendário Mosaicos/Camadas"
                            align="left"
                            onSelect={handleSelectLeft}
                            onSelectDroneDate={(dayKey) => onDroneDateClick?.("left", dayKey)}
                            selected={selectedLeft}
                            onChangeSelected={setSelectedLeft}
                            droneDates={droneDates}
                        />
                    </div>
                )}
            </div>

            <div className="dual-map-wrapper">
                <div ref={rightDivRef} className="dual-map" />

                <div className="calendario-botao-direito" style={{ left: "50%" }}>
                    <button
                        onClick={() => setShowRightCalendar((v) => !v)}
                        title="Abrir calendário direito"
                    >
                        🗓️
                    </button>
                    <span>{labelRight}</span>
                </div>

                {showRightCalendar && (
                    <div
                        style={{
                            position: "absolute",
                            bottom: 95,
                            left: "50%",
                            transform: "translateX(-50%)",
                            background: "var(--panel, #fff)",
                            borderRadius: 12,
                            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
                            zIndex: 3000,
                            width: "180px",
                            minWidth: "180px",
                        }}
                    >
                        <MosaicCalendar
                            mosaics={mosaics}
                            title="Calendário Mosaicos/Camadas"
                            align="right"
                            onSelect={handleSelectRight}
                            onSelectDroneDate={(dayKey) => onDroneDateClick?.("right", dayKey)}
                            selected={selectedRight}
                            onChangeSelected={setSelectedRight}
                            droneDates={droneDates}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}