import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";

import TemporalLayersPanel from "./TemporalLayersPanel";
import { useAppStore } from "../../core/store";
import { buildPlanetTileUrl } from "../../core/mosaicUtils";
import MapToolbar from "../../components/MapToolbar";

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

    const setLastViewpoint = useAppStore((s) => s.setLastViewpoint);

    // 🗓️ Painel temporal — estado no store para persistir entre trocas de modo
    const showTemporalPanel = useAppStore((s) => s.showTemporalPanel);
    const setShowTemporalPanel = useAppStore((s) => s.setShowTemporalPanel);

    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    const leftLayerRef = useRef<WebTileLayer | null>(null);
    const rightLayerRef = useRef<WebTileLayer | null>(null);

    const syncingRef = useRef(false);
    const cleanupHandlesRef = useRef<(() => void)[]>([]);

    const onViewsReadyRef = useRef<typeof onViewsReady>(onViewsReady);

    // 🗓️ Estado de exibição do painel temporal

    const [selectedSidePanel, setSelectedSidePanel] = useState<"left" | "right">("left");

    const [currentLeft, setCurrentLeft] = useState(leftTileUrl);
    const [currentRight, setCurrentRight] = useState(rightTileUrl);

    const [labelLeft, setLabelLeft] = useState(titleLeft);
    const [labelRight, setLabelRight] = useState(titleRight);

    const [, setSelectedLeft] = useState<{
        year: number;
        month: number;
        day?: number;
    } | null>(null);

    const [, setSelectedRight] = useState<{
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

                const vpWatch = reactiveUtils.watch(
                    () => leftView.viewpoint,
                    (vp) => {
                        if (vp) {
                            setLastViewpoint(vp.clone());
                        }
                    }
                );

                cleanupHandlesRef.current.push(() => syncFromLeft.remove());
                cleanupHandlesRef.current.push(() => syncFromRight.remove());
                cleanupHandlesRef.current.push(() => vpWatch.remove());

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

    const handleMosaicApply = (side: "left" | "right", mosaic: any) => {
        if (!mosaic?.id) return;
        const nextUrl = buildPlanetTileUrl(mosaic.id);

        const raw = mosaic.date || mosaic.when || mosaic.label || "";
        const hit3 = String(raw).match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
        const hit2 = String(raw).match(/(\d{4})[-_/\.](\d{2})/);

        let parsedYear = 0;
        let parsedMonth = 0;
        let parsedDay: number | undefined;
        let newLabel = "";

        if (hit3) {
            parsedYear = parseInt(hit3[1], 10);
            parsedMonth = parseInt(hit3[2], 10);
            parsedDay = parseInt(hit3[3], 10);
            newLabel = `${hit3[3]}/${hit3[2]}/${hit3[1]}`;
        } else if (hit2) {
            parsedYear = parseInt(hit2[1], 10);
            parsedMonth = parseInt(hit2[2], 10);
            parsedDay = new Date(parsedYear, parsedMonth, 0).getDate();
            newLabel = `${String(parsedDay).padStart(2, "0")}/${hit2[2]}/${hit2[1]}`;
        } else {
            newLabel = raw;
        }

        if (side === "left") {
            setCurrentLeft(nextUrl);
            setLabelLeft(newLabel);
            if (parsedYear && parsedMonth) {
                setSelectedLeft({ year: parsedYear, month: parsedMonth, day: parsedDay });
            }
        } else {
            setCurrentRight(nextUrl);
            setLabelRight(newLabel);
            if (parsedYear && parsedMonth) {
                setSelectedRight({ year: parsedYear, month: parsedMonth, day: parsedDay });
            }
        }

        onMosaicChange?.(side, mosaic.id);
    };

    return (
        <div className="dual-maps-page">
            <div className="dual-map-wrapper">
                <div ref={leftDivRef} className="dual-map" />

                {/* Botão Badge Esquerdo */}
                <div className="calendario-botao-esquerdo" title="Data do Mosaico" style={{ left: "50%" }}>
                    <div className="calendario-botao">
                        <span>{labelLeft}</span>
                    </div>
                </div>
            </div>

            <div className="dual-map-wrapper">
                <div ref={rightDivRef} className="dual-map" />

                {/* Botão Badge Direito */}
                <div className="calendario-botao-direito" title="Data do Mosaico" style={{ left: "50%" }}>
                    <div className="calendario-botao">
                        <span>{labelRight}</span>
                    </div>
                </div>
            </div>

            {/* 🛠️ Barra de ferramentas */}
            <MapToolbar showLayersBtn={true} />

            {/* Painel temporal — posicionamento independente do botão */}
            {showTemporalPanel && (
                <div>
                    <TemporalLayersPanel
                        mosaics={mosaics}
                        droneDates={droneDates}
                        image360Dates={new Set()} // Will be populated later if needed in Swipe screen
                        selectedSide={selectedSidePanel}
                        onSideChange={setSelectedSidePanel}
                        onMosaicApply={handleMosaicApply}
                        onDroneApply={onDroneDateClick}
                        onClose={() => setShowTemporalPanel(false)}
                    />
                </div>
            )}
        </div >
    );
}