import React, { useEffect, useRef, useState } from "react";
import TileSwipeViewer from "./TileSwipeViewer";
import FeatureServiceList from "./FeatureServiceList";
import DualTileMapsViewer from "./DualTileMapsViewer";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import MapView from "@arcgis/core/views/MapView";
import Viewpoint from "@arcgis/core/Viewpoint";

import "./SwipePage.css";
import { useAppStore } from "../../core/store";
import { CONFIG } from "../../core/config";
import { Setup360OnView } from "../imagem_360/Setup360OnView";

type LayerItem = {
    id: string;
    title: string;
    url: string;
};

type MapImageItem = {
    id: string;
    title: string;
    url: string;
    descricao?: string | null;
    created?: number;
    modified?: number;
    serviceUrl?: string;
    portalItemUrl?: string;
    thumbnailUrl?: string;
    tipo?: string;
    owner?: string;
    access?: string;
    tags?: string[];
};

const SwipePage: React.FC = () => {
    /* =========================
       Planet mosaics (store)
       ========================= */
    const mosaics = useAppStore((s) => s.planetMosaics);
    const mosaicsLoading = useAppStore((s) => s.planetMosaicsLoading);
    const mosaicsError = useAppStore((s) => s.planetMosaicsError);
    const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);
    const setPlanetSelectedId = useAppStore((s) => s.setPlanetSelectedId);

    /* =========================
       Swipe state
       ========================= */
    const [leftMosaicId, setLeftMosaicId] = useState<string | null>(null);
    const [rightMosaicId, setRightMosaicId] = useState<string | null>(null);

    const [featureServices, setFeatureServices] = useState<LayerItem[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [loadingFeatures, setLoadingFeatures] = useState(true);

    const [mapReady, setMapReady] = useState(false);
    const [showCamadas, setShowCamadas] = useState(false);

    // alterna Swipe x 2 mapas
    const [dualMode, setDualMode] = useState(false);

    // guarda viewpoint do swipe pra iniciar os dois mapas
    const lastViewpointRef = useRef<Viewpoint | null>(null);

    // refs das views
    const swipeViewRef = useRef<MapView | null>(null);
    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    // cleanups do Setup360OnView
    const swipeSetupCleanupRef = useRef<null | (() => void)>(null);
    const leftSetupCleanupRef = useRef<null | (() => void)>(null);
    const rightSetupCleanupRef = useRef<null | (() => void)>(null);

    // tokens para invalidar inicializações antigas
    const swipeInitTokenRef = useRef(0);
    const leftInitTokenRef = useRef(0);
    const rightInitTokenRef = useRef(0);

    // camadas ativas
    const [activeFeatureUrls, setActiveFeatureUrls] = useState<string[]>([]);
    const [activeMapImageUrls, setActiveMapImageUrls] = useState<string[]>([]);

    // Map Image Layers
    const [mapImageLayers, setMapImageLayers] = useState<MapImageItem[]>([]);
    const [mapImageLayersLoading, setMapImageLayersLoading] = useState(true);
    const [mapImageLayersError, setMapImageLayersError] = useState<string | null>(null);

    /* 1️⃣ Carrega mosaics */
    useEffect(() => {
        loadPlanetMosaics();
    }, [loadPlanetMosaics]);

    /* 2️⃣ Define defaults */
    useEffect(() => {
        if (!mosaics.length) return;

        if (!leftMosaicId) {
            setLeftMosaicId(mosaics[0].id);
            setPlanetSelectedId(mosaics[0].id);
        }

        if (!rightMosaicId) {
            setRightMosaicId((mosaics[0] || mosaics[0]).id);
        }
    }, [mosaics, leftMosaicId, rightMosaicId, setPlanetSelectedId]);

    /* 3️⃣ Carrega Feature Services */
    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const r = await fetch(`${CONFIG.API_BASE}/features`, {
                    credentials: "include",
                });

                if (!r.ok) {
                    throw new Error("Erro ao buscar dados dos Features");
                }

                const data = await r.json();

                const featureOnly: LayerItem[] = (data || [])
                    .filter((f: any) => f.featureUrl || f.serviceUrl)
                    .map((f: any) => ({
                        id: String(f.id ?? f.title ?? f.featureUrl ?? f.serviceUrl),
                        title: f.title ?? f.name ?? "Feature Layer",
                        url: f.featureUrl || f.serviceUrl,
                    }));

                setFeatureServices(featureOnly);
            } catch (e) {
                setErro(e instanceof Error ? e.message : "Erro ao carregar features");
            } finally {
                setLoadingFeatures(false);
            }
        };

        fetchFeatures();
    }, []);

    /* 4️⃣ Carrega Map Image Layers */
    useEffect(() => {
        const fetchMapImageLayers = async () => {
            try {
                setMapImageLayersLoading(true);
                setMapImageLayersError(null);

                const r = await fetch(`${CONFIG.API_BASE}/map-image-layers`, {
                    credentials: "include",
                });

                if (!r.ok) {
                    throw new Error(`Erro ao buscar Map Image Layers: ${r.status}`);
                }

                const data = await r.json();
                const items = Array.isArray(data) ? data : [];

                const mapImages: MapImageItem[] = items
                    .filter((item: any) => item.serviceUrl || item.url)
                    .map((item: any) => ({
                        id: String(item.id ?? item.title ?? item.serviceUrl ?? item.url),
                        title: item.title ?? item.name ?? "Map Image Layer",
                        url: item.serviceUrl || item.url,
                        descricao: item.descricao,
                        created: item.created,
                        modified: item.modified,
                        serviceUrl: item.serviceUrl,
                        portalItemUrl: item.portalItemUrl,
                        thumbnailUrl: item.thumbnailUrl,
                        tipo: item.tipo,
                        owner: item.owner,
                        access: item.access,
                        tags: Array.isArray(item.tags) ? item.tags : [],
                    }))
                    .filter((item: MapImageItem) => !!item.url);

                setMapImageLayers(mapImages);
            } catch (e) {
                console.error("Erro ao carregar Map Image Layers:", e);
                setMapImageLayersError(
                    e instanceof Error ? e.message : "Erro ao carregar Map Image Layers"
                );
            } finally {
                setMapImageLayersLoading(false);
            }
        };

        fetchMapImageLayers();
    }, []);

    /* cleanup geral ao desmontar */
    useEffect(() => {
        return () => {
            swipeInitTokenRef.current += 1;
            leftInitTokenRef.current += 1;
            rightInitTokenRef.current += 1;

            swipeSetupCleanupRef.current?.();
            swipeSetupCleanupRef.current = null;

            leftSetupCleanupRef.current?.();
            leftSetupCleanupRef.current = null;

            rightSetupCleanupRef.current?.();
            rightSetupCleanupRef.current = null;
        };
    }, []);

    /* helper: views ativas */
    const getActiveViews = (): MapView[] => {
        if (dualMode) {
            const v: MapView[] = [];
            if (leftViewRef.current) v.push(leftViewRef.current);
            if (rightViewRef.current) v.push(rightViewRef.current);
            return v;
        }

        return swipeViewRef.current ? [swipeViewRef.current] : [];
    };

    const init360OnView = (
        view: MapView,
        cleanupRef: React.MutableRefObject<null | (() => void)>,
        tokenRef: React.MutableRefObject<number>,
        label: string
    ) => {
        tokenRef.current += 1;
        const token = tokenRef.current;

        cleanupRef.current?.();
        cleanupRef.current = null;

        view.when()
            .then(() => {
                if (tokenRef.current !== token) return;
                cleanupRef.current = Setup360OnView(view);
            })
            .catch((err) => {
                console.error(`view.when() falhou no SwipePage (${label}):`, err);
            });
    };

    /* add/remove feature layer */
    const handleToggleFeatureLayer = (layerUrl: string, visible: boolean) => {
        const views = getActiveViews();
        if (!views.length) return;

        const layerId = `feature-${layerUrl}`;

        if (visible) {
            views.forEach((view) => {
                const already = view.map?.findLayerById(layerId);

                if (!already) {
                    const layer = new FeatureLayer({ url: layerUrl, id: layerId });
                    view.map?.add(layer, 9999);
                }
            });

            setActiveFeatureUrls((prev) =>
                prev.includes(layerUrl) ? prev : [...prev, layerUrl]
            );
        } else {
            views.forEach((view) => {
                const toRemove = view.map?.findLayerById(layerId);

                if (toRemove) {
                    view.map?.remove(toRemove);
                }
            });

            setActiveFeatureUrls((prev) => prev.filter((u) => u !== layerUrl));
        }
    };

    /* add/remove map image layer */
    const handleToggleMapImageLayer = (layerUrl: string, visible: boolean) => {
        const views = getActiveViews();
        if (!views.length) return;

        const layerId = `map-image-${layerUrl}`;

        if (visible) {
            views.forEach((view) => {
                const already = view.map?.findLayerById(layerId);

                if (!already) {
                    const layer = new MapImageLayer({ url: layerUrl, id: layerId });
                    
                    const layers = view.map?.layers.toArray() || [];
                    const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                    const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
                    
                    view.map?.add(layer, insertIndex);
                }
            });

            setActiveMapImageUrls((prev) =>
                prev.includes(layerUrl) ? prev : [...prev, layerUrl]
            );
        } else {
            views.forEach((view) => {
                const toRemove = view.map?.findLayerById(layerId);

                if (toRemove) {
                    view.map?.remove(toRemove);
                }
            });

            setActiveMapImageUrls((prev) => prev.filter((u) => u !== layerUrl));
        }
    };

    /* reaplica camadas ativas ao trocar de modo */
    const reapplyActiveLayers = (views: MapView[]) => {
        activeFeatureUrls.forEach((url) => {
            const layerId = `feature-${url}`;
            views.forEach((view) => {
                const already = view.map?.findLayerById(layerId);

                if (!already) {
                    view.map?.add(new FeatureLayer({ url, id: layerId }), 9999);
                }
            });
        });

        activeMapImageUrls.forEach((url) => {
            const layerId = `map-image-${url}`;
            views.forEach((view) => {
                const already = view.map?.findLayerById(layerId);

                if (!already) {
                    const layer = new MapImageLayer({ url, id: layerId });
                    
                    const layers = view.map?.layers.toArray() || [];
                    const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                    const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
                    
                    view.map?.add(layer, insertIndex);
                }
            });
        });
    };

    /* aplica todas as imagens aos mapas inicialmente (posteriormente será filtrado por calendário) */
    const applyAllMapImageLayersToViews = async (views: MapView[]) => {
        if (!views.length || !mapImageLayers.length) return;

        const urlsAdded: string[] = [];

        views.forEach((v) => {
            mapImageLayers.forEach((item) => {
                if (!item.url) return;

                const layerId = `map-image-${item.url}`;
                const already = v.map?.findLayerById(layerId);

                if (!already) {
                    const layer = new MapImageLayer({
                        url: item.url,
                        id: layerId,
                    });
                    
                    const layers = v.map?.layers.toArray() || [];
                    const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                    const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
                    
                    v.map?.add(layer, insertIndex);
                }

                urlsAdded.push(item.url);
            });
        });

        setActiveMapImageUrls((prev) => {
            const merged = new Set([...prev, ...urlsAdded]);
            return Array.from(merged);
        });

        console.log(
            "Todas as Map Image Layers aplicadas:",
            mapImageLayers.map((x) => x.title)
        );
    };

    /* loading / error */
    if (mosaicsLoading || loadingFeatures || mapImageLayersLoading) {
        return <p>Carregando…</p>;
    }

    if (mosaicsError) return <p>{mosaicsError}</p>;
    if (erro) return <p>{erro}</p>;
    if (mapImageLayersError) return <p>{mapImageLayersError}</p>;

    /* URLs finais */
    const left = mosaics.find((m) => m.id === leftMosaicId);
    const right = mosaics.find((m) => m.id === rightMosaicId) || left;

    const leftUrl = left
        ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${left.id}`
        : "";

    const rightUrl = right
        ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${right.id}`
        : "";

    const iconClass = showCamadas ? "fa-solid fa-xmark" : "fa-solid fa-layer-group";

    const titleLeft = left?.when
        ? (() => {
            const [y, mo] = left.when.split("-");
            return `${mo}/${y}`;
        })()
        : "?";

    const titleRight = right?.when
        ? (() => {
            const [y, mo] = right.when.split("-");
            return `${mo}/${y}`;
        })()
        : "?";

    const toggleDualMode = () => {
        if (!dualMode) {
            if (swipeViewRef.current?.viewpoint) {
                lastViewpointRef.current = swipeViewRef.current.viewpoint.clone();
            }

            swipeInitTokenRef.current += 1;
            swipeSetupCleanupRef.current?.();
            swipeSetupCleanupRef.current = null;
        } else {
            if (leftViewRef.current?.viewpoint) {
                lastViewpointRef.current = leftViewRef.current.viewpoint.clone();
            }

            leftInitTokenRef.current += 1;
            rightInitTokenRef.current += 1;

            leftSetupCleanupRef.current?.();
            leftSetupCleanupRef.current = null;

            rightSetupCleanupRef.current?.();
            rightSetupCleanupRef.current = null;
        }

        setMapReady(false);
        setDualMode((v) => !v);
    };

    return (
        <div id="webmap-container">
            <section id="mapa">
                <button
                    className="btn-dualmode"
                    title={dualMode ? "Voltar para Swipe" : "Travar swipe e usar 2 mapas independentes"}
                    onClick={toggleDualMode}
                >
                    {dualMode ? "Voltar Swipe" : "2 Mapas"}
                </button>

                {leftUrl && rightUrl ? (
                    <>
                        {!dualMode ? (
                            <TileSwipeViewer
                                leftTileUrl={leftUrl}
                                rightTileUrl={rightUrl}
                                mosaics={mosaics}
                                titleLeft={titleLeft}
                                titleRight={titleRight}
                                initialViewpoint={lastViewpointRef.current || undefined}
                                onViewReady={async (view) => {
                                    swipeViewRef.current = view;
                                    leftViewRef.current = null;
                                    rightViewRef.current = null;

                                    reapplyActiveLayers([view]);
                                    await applyAllMapImageLayersToViews([view]);

                                    init360OnView(
                                        view,
                                        swipeSetupCleanupRef,
                                        swipeInitTokenRef,
                                        "swipe"
                                    );

                                    setMapReady(true);
                                }}
                            />
                        ) : (
                            <DualTileMapsViewer
                                leftTileUrl={leftUrl}
                                rightTileUrl={rightUrl}
                                titleLeft={titleLeft}
                                titleRight={titleRight}
                                initialViewpoint={lastViewpointRef.current || undefined}
                                onViewsReady={async ({ leftView, rightView }) => {
                                    swipeViewRef.current = null;
                                    leftViewRef.current = leftView;
                                    rightViewRef.current = rightView;

                                    reapplyActiveLayers([leftView, rightView]);
                                    await applyAllMapImageLayersToViews([leftView, rightView]);

                                    init360OnView(
                                        leftView,
                                        leftSetupCleanupRef,
                                        leftInitTokenRef,
                                        "dual-left"
                                    );

                                    init360OnView(
                                        rightView,
                                        rightSetupCleanupRef,
                                        rightInitTokenRef,
                                        "dual-right"
                                    );

                                    setMapReady(true);
                                }}
                            />
                        )}

                        <i
                            className={`${iconClass} btn-camadas-icon`}
                            title={showCamadas ? "Esconder camadas" : "Mostrar camadas"}
                            onClick={() => setShowCamadas(!showCamadas)}
                        />

                        <div className={`camadas ${showCamadas ? "aberta" : "fechada"}`}>
                            <h5>Feature Layers</h5>
                            <FeatureServiceList
                                services={featureServices.map((fs) => ({
                                    id: fs.id,
                                    title: fs.title,
                                    featureUrl: fs.url,
                                }))}
                                onToggleLayer={handleToggleFeatureLayer}
                                visible={mapReady}
                                activeLayerUrls={activeFeatureUrls}
                            />

                            <h5 style={{ marginTop: 12 }}>Map Image Layers</h5>
                            <FeatureServiceList
                                services={mapImageLayers.map((srv) => ({
                                    id: srv.id,
                                    title: srv.title,
                                    featureUrl: srv.url,
                                }))}
                                onToggleLayer={handleToggleMapImageLayer}
                                visible={mapReady}
                                activeLayerUrls={activeMapImageUrls}
                            />
                        </div>
                    </>
                ) : (
                    <p>Selecione dois mosaicos para comparar</p>
                )}
            </section>
        </div>
    );
};

export default SwipePage;