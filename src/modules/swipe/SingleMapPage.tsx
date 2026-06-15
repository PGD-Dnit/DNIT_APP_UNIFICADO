import React, { useEffect, useMemo, useRef, useState } from "react";
import SingleTileMapViewer from "./SingleTileMapViewer";
import FeatureServiceList from "./FeatureServiceList";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import MapView from "@arcgis/core/views/MapView";

import "./SingleMapPage.css";
import { useAppStore } from "../../core/store";
import { CONFIG } from "../../core/config";
import { buildPlanetTileUrl } from "../../core/mosaicUtils";
import { Setup360OnView } from "../imagem_360/Setup360OnView";
import { SetupImageOnView } from "../imagem_obra/SetupImageOnView";
import {
    type MapImageItem,
    parseDroneServiceName,
    parseExtent,
    getExtentCenter,
    getExtentArea,
    groupDroneImages,
    formatCoord,
} from "../../core/droneUtils";

/* ─────────────────────────────────────────────────────────────
   Tipos locais
───────────────────────────────────────────────────────────── */
type LayerItem = {
    id: string;
    title: string;
    url: string;
};

/* ─────────────────────────────────────────────────────────────
   Componente principal
───────────────────────────────────────────────────────────── */
const SingleMapPage: React.FC = () => {
    const mosaics = useAppStore((s) => s.planetMosaics);
    const mosaicsLoading = useAppStore((s) => s.planetMosaicsLoading);
    const mosaicsError = useAppStore((s) => s.planetMosaicsError);
    const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);
    const setPlanetSelectedId = useAppStore((s) => s.setPlanetSelectedId);

    const droneLayersVisible = useAppStore((s) => s.droneLayersVisible);
    const lastViewpoint = useAppStore((s) => s.lastViewpoint);
    // const setLastViewpoint = useAppStore((s) => s.setLastViewpoint);

    const [activeMosaicId, setActiveMosaicId] = useState<string | null>(null);

    const [featureServices, setFeatureServices] = useState<LayerItem[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [loadingFeatures, setLoadingFeatures] = useState(true);

    const [mapReady, setMapReady] = useState(false);
    const showCamadas = useAppStore((s) => s.showCamadas);
    const setShowCamadas = useAppStore((s) => s.setShowCamadas);

    const mapViewRef = useRef<MapView | null>(null);
    const setupCleanupRef = useRef<null | (() => void)>(null);
    const initTokenRef = useRef(0);

    const [activeFeatureUrls, setActiveFeatureUrls] = useState<string[]>([]);
    const [activeMapImageUrls, setActiveMapImageUrls] = useState<string[]>([]);

    const [mapImageLayers, setMapImageLayers] = useState<MapImageItem[]>([]);
    const [mapImageLayersLoading, setMapImageLayersLoading] = useState(true);
    const [mapImageLayersError, setMapImageLayersError] = useState<string | null>(null);

    const [selectedDroneGroupKey, setSelectedDroneGroupKey] = useState<string | null>(null);
    const [selectedDroneDay, setSelectedDroneDay] = useState<string | null>(null);

    const droneDateFilter = useAppStore((s) => s.droneDateFilter);

    /* ── Toggle visibilidade camadas drone ── */
    useEffect(() => {
        const view = mapViewRef.current;
        if (!view) return;
        view.map?.layers.forEach((layer: any) => {
            if (typeof layer.id === "string" && layer.id.startsWith("map-image-")) {
                layer.visible = droneLayersVisible;
            }
        });
    }, [droneLayersVisible]);

    /* ── Suprimir erros de abort ── */
    useEffect(() => {
        const handler = (event: PromiseRejectionEvent) => {
            const r = event.reason;
            if (r && (r.name === "AbortError" || r.name === "cancelled:layerview-create" || r.message?.includes("AbortError") || r.message?.includes("layerview creation cancelled"))) {
                event.preventDefault();
            }
        };
        window.addEventListener("unhandledrejection", handler);
        return () => window.removeEventListener("unhandledrejection", handler);
    }, []);

    useEffect(() => { loadPlanetMosaics(); }, [loadPlanetMosaics]);

    /* ── Selecionar mosaic inicial ── */
    useEffect(() => {
        if (!mosaics.length) return;
        if (!activeMosaicId) {
            setActiveMosaicId(mosaics[0].id);
            setPlanetSelectedId(mosaics[0].id);
        }
    }, [mosaics, activeMosaicId, setPlanetSelectedId]);

    /* ── Carregar Feature Layers ── */
    useEffect(() => {
        const fetchFeatures = async () => {
            try {
                const r = await fetch(`${CONFIG.API_BASE}/features`, { credentials: "include" });
                if (!r.ok) throw new Error("Erro ao buscar dados dos Features");
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

    /* ── Carregar Map Image Layers ── */
    useEffect(() => {
        const fetchMapImageLayers = async () => {
            try {
                setMapImageLayersLoading(true);
                setMapImageLayersError(null);
                const r = await fetch(`${CONFIG.API_BASE}/map-image-layers`, { credentials: "include" });
                if (!r.ok) throw new Error(`Erro ao buscar Map Image Layers: ${r.status}`);
                const data = await r.json();
                const items = Array.isArray(data) ? data : [];

                const parsedItems: MapImageItem[] = items
                    .filter((item: any) => item.serviceUrl || item.url)
                    .map((item: any) => {
                        const rawServiceName = String(item?.serviceName ?? "").trim() || String(item?.title ?? "").trim() || null;
                        const parsedName = rawServiceName
                            ? parseDroneServiceName(rawServiceName)
                            : { rawServiceName: null, pointName: null, pointKey: null, dayKey: null, sourceDateMs: null };

                        const fullExtent = parseExtent(item?.fullExtent) || null;
                        const initialExtent = parseExtent(item?.initialExtent) || null;
                        const center = getExtentCenter(fullExtent);
                        const areaM2 = getExtentArea(fullExtent);

                        return {
                            id: String(item.id ?? item.title ?? item.serviceUrl ?? item.url),
                            title: item.title ?? item.name ?? rawServiceName ?? "Map Image Layer",
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
                            serviceName: item.serviceName ?? null,
                            rawServiceName: parsedName.rawServiceName,
                            pointName: parsedName.pointName,
                            pointKey: parsedName.pointKey,
                            dayKey: parsedName.dayKey,
                            sourceDateMs: parsedName.sourceDateMs,
                            fullExtent,
                            initialExtent,
                            center,
                            areaM2,
                        };
                    })
                    .filter((item: MapImageItem) => !!item.url);

                setMapImageLayers(parsedItems);
            } catch (e) {
                console.error("Erro ao carregar Map Image Layers:", e);
                setMapImageLayersError(e instanceof Error ? e.message : "Erro ao carregar Map Image Layers");
            } finally {
                setMapImageLayersLoading(false);
            }
        };
        fetchMapImageLayers();
    }, []);

    /* ── Cleanup ao desmontar ── */
    useEffect(() => {
        return () => {
            initTokenRef.current += 1;
            setupCleanupRef.current?.();
            setupCleanupRef.current = null;
        };
    }, []);

    /* ── Agrupamento de drones ── */
    const filteredMapImageLayers = useMemo(() => {
        if (!droneDateFilter.start && !droneDateFilter.end) return mapImageLayers;
        return mapImageLayers.filter((layer) => {
            if (!layer.sourceDateMs) return false;
            const d = layer.sourceDateMs;
            if (droneDateFilter.start && d < droneDateFilter.start) return false;
            if (droneDateFilter.end && d > droneDateFilter.end) return false;
            return true;
        });
    }, [mapImageLayers, droneDateFilter]);

    const droneGroups = useMemo(() => groupDroneImages(filteredMapImageLayers), [filteredMapImageLayers]);
    const droneGroupsMap = useMemo(() => new Map(droneGroups.map((g) => [g.groupKey, g])), [droneGroups]);
    const latestMapImageByGroup = useMemo(() => droneGroups.map((g) => g.latestItem).filter((item): item is MapImageItem => !!item), [droneGroups]);

    const selectedDroneGroup = useMemo(() => {
        return selectedDroneGroupKey ? droneGroupsMap.get(selectedDroneGroupKey) ?? null : null;
    }, [selectedDroneGroupKey, droneGroupsMap]);

    const activeGroupDroneDatesSet = useMemo(() => {
        const dates = new Set<string>();
        if (selectedDroneGroup) selectedDroneGroup.items.forEach((item) => { if (item.dayKey) dates.add(item.dayKey); });
        return dates;
    }, [selectedDroneGroup]);

    const selectedGroupAvailableDays = useMemo(() => {
        if (!selectedDroneGroup) return [];
        const unique = new Set(selectedDroneGroup.items.map((item) => item.dayKey).filter((d): d is string => !!d));
        return Array.from(unique).sort((a, b) => b.localeCompare(a));
    }, [selectedDroneGroup]);

    /* ── Auto-select primeiro grupo ── */
    useEffect(() => {
        if (!droneGroups.length) return;
        if (!selectedDroneGroupKey || !droneGroupsMap.has(selectedDroneGroupKey)) {
            const firstGroup = droneGroups[0];
            setSelectedDroneGroupKey(firstGroup.groupKey);
            setSelectedDroneDay(firstGroup.latestItem?.dayKey ?? null);
        }
    }, [droneGroups, droneGroupsMap, selectedDroneGroupKey]);

    /* ── Aplicar camadas drone na view ── */
    const removeAllDroneLayers = (view: MapView) => {
        const layers = view.map?.layers.toArray() || [];
        layers.forEach((layer: any) => {
            if (layer?.id && typeof layer.id === "string" && layer.id.startsWith("map-image-")) {
                view.map?.remove(layer);
            }
        });
    };

    const addMapImageLayer = (view: MapView, item: MapImageItem) => {
        if (!item.url) return;
        const layerId = `map-image-${item.url}`;
        const already = view.map?.findLayerById(layerId);
        if (!already) {
            const layer = new MapImageLayer({ url: item.url, id: layerId });
            const layers = view.map?.layers.toArray() || [];
            const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
            const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
            view.map?.add(layer, insertIndex);
        }
    };

    const applyDroneSelection = (view: MapView, groupKey: string | null, dayKey: string | null) => {
        removeAllDroneLayers(view);
        const uniqueUrls = new Set<string>();

        if (groupKey) {
            const group = droneGroupsMap.get(groupKey);
            if (group) {
                const items = dayKey ? group.items.filter((item) => item.dayKey === dayKey) : group.latestItem ? [group.latestItem] : [];
                items.forEach((item) => { addMapImageLayer(view, item); uniqueUrls.add(item.url); });

                const latestOthers = latestMapImageByGroup.filter((item) => !group.items.some((gItem) => gItem.id === item.id));
                latestOthers.forEach((item) => { addMapImageLayer(view, item); uniqueUrls.add(item.url); });
            }
        } else {
            latestMapImageByGroup.forEach((item) => { addMapImageLayer(view, item); uniqueUrls.add(item.url); });
        }

        setActiveMapImageUrls(Array.from(uniqueUrls));
    };

    /* ── Reaplica camadas ao trocar de view ── */
    const reapplyActiveLayers = (view: MapView) => {
        activeFeatureUrls.forEach((url) => {
            const layerId = `feature-${url}`;
            if (!view.map?.findLayerById(layerId)) {
                view.map?.add(new FeatureLayer({ url, id: layerId }), 9999);
            }
        });
    };

    const reapplyActiveMapImageLayers = (view: MapView) => {
        activeMapImageUrls.forEach((url) => {
            const layerId = `map-image-${url}`;
            if (!view.map?.findLayerById(layerId)) {
                const layer = new MapImageLayer({ url, id: layerId });
                const layers = view.map?.layers.toArray() || [];
                const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
                view.map?.add(layer, insertIndex);
            }
        });
    };

    /* ── Reaplica drone ao mudar seleção ── */
    useEffect(() => {
        const view = mapViewRef.current;
        if (!view || !mapReady) return;
        applyDroneSelection(view, selectedDroneGroupKey, selectedDroneDay);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapReady, selectedDroneGroupKey, selectedDroneDay, latestMapImageByGroup, droneGroupsMap]);

    /* ── Handlers ── */
    const handleToggleFeatureLayer = (layerUrl: string, visible: boolean) => {
        const view = mapViewRef.current;
        if (!view) return;
        const layerId = `feature-${layerUrl}`;
        if (visible) {
            if (!view.map?.findLayerById(layerId)) {
                view.map?.add(new FeatureLayer({ url: layerUrl, id: layerId }), 9999);
            }
            setActiveFeatureUrls((prev) => (prev.includes(layerUrl) ? prev : [...prev, layerUrl]));
        } else {
            const toRemove = view.map?.findLayerById(layerId);
            if (toRemove) view.map?.remove(toRemove);
            setActiveFeatureUrls((prev) => prev.filter((u) => u !== layerUrl));
        }
    };

    const handleToggleMapImageLayer = (layerUrl: string, visible: boolean) => {
        const view = mapViewRef.current;
        if (!view) return;
        const layerId = `map-image-${layerUrl}`;
        if (visible) {
            if (!view.map?.findLayerById(layerId)) {
                const layer = new MapImageLayer({ url: layerUrl, id: layerId });
                const layers = view.map?.layers.toArray() || [];
                const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;
                view.map?.add(layer, insertIndex);
            }
            setActiveMapImageUrls((prev) => (prev.includes(layerUrl) ? prev : [...prev, layerUrl]));
        } else {
            const toRemove = view.map?.findLayerById(layerId);
            if (toRemove) view.map?.remove(toRemove);
            setActiveMapImageUrls((prev) => prev.filter((u) => u !== layerUrl));
        }
    };

    const handleDroneDateClick = (dayKey: string) => {
        const view = mapViewRef.current;
        if (!view) return;
        const matchingGroup = droneGroups.find((g) => g.items.some((item) => item.dayKey === dayKey));
        const groupKey = matchingGroup?.groupKey ?? null;
        setSelectedDroneGroupKey(groupKey);
        setSelectedDroneDay(dayKey);
        applyDroneSelection(view, groupKey, dayKey);
    };

    /* ── Loading / erro ── */
    if (mosaicsLoading || loadingFeatures || mapImageLayersLoading) {
        return <p>Carregando…</p>;
    }
    if (mosaicsError) return <p>{mosaicsError}</p>;
    if (erro) return <p>{erro}</p>;
    if (mapImageLayersError) return <p>{mapImageLayersError}</p>;

    /* ── URL do tile ativo ── */
    const activeMosaic = mosaics.find((m) => m.id === activeMosaicId);
    const tileUrl = activeMosaic
        ? buildPlanetTileUrl(activeMosaic.id)
        : "";

    const mosaicTitle = activeMosaic?.when
        ? (() => {
            const match3 = activeMosaic.when.match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
            if (match3) return `${match3[3]}/${match3[2]}/${match3[1]}`;
            const match2 = activeMosaic.when.match(/(\d{4})[-_/\.](\d{2})/);
            if (match2) {
                const y = parseInt(match2[1], 10);
                const mo = parseInt(match2[2], 10);
                const endD = String(new Date(y, mo, 0).getDate()).padStart(2, "0");
                return `${endD}/${match2[2]}/${match2[1]}`;
            }
            return activeMosaic.when;
        })()
        : "?";



    /* ── Render ── */
    return (
        <div id="single-map-container">
            <section id="single-mapa">
                {tileUrl ? (
                    <>
                        <SingleTileMapViewer
                            tileUrl={tileUrl}
                            title={mosaicTitle}
                            mosaics={mosaics}
                            initialViewpoint={lastViewpoint || undefined}
                            droneDates={activeGroupDroneDatesSet}
                            onDroneDateClick={handleDroneDateClick}
                            onMosaicChange={(mosaicId) => {
                                setActiveMosaicId(mosaicId);
                                setPlanetSelectedId(mosaicId);
                            }}
                            onViewReady={async (view) => {
                                mapViewRef.current = view;

                                reapplyActiveLayers(view);
                                reapplyActiveMapImageLayers(view);
                                applyDroneSelection(view, selectedDroneGroupKey, selectedDroneDay);

                                /* Setup panoramas e imagens de obra */
                                initTokenRef.current += 1;
                                const token = initTokenRef.current;
                                setupCleanupRef.current?.();
                                setupCleanupRef.current = null;

                                view.when()
                                    .then(() => {
                                        if (initTokenRef.current !== token) return;
                                        const cleanup360 = Setup360OnView(view);
                                        const cleanupObra = SetupImageOnView(view);
                                        setupCleanupRef.current = () => { cleanup360(); cleanupObra(); };
                                    })
                                    .catch((err) => console.error("view.when() falhou no SingleMapPage:", err));

                                setMapReady(true);
                            }}
                        />


                        {/* Painel lateral de camadas */}
                        <aside className={`single-camadas ${showCamadas ? "aberta" : "fechada"}`}>
                            <div className="single-camadas-header">
                                <div className="single-camadas-header-text">
                                    <h4>Painel de Camadas</h4>
                                    <span className="single-camadas-subtitle">
                                        Controle das layers e grupos de drone
                                    </span>
                                </div>
                                <button
                                    className="temporal-close-btn"
                                    onClick={() => setShowCamadas(false)}
                                    title="Fechar painel"
                                >
                                    &times;
                                </button>
                            </div>

                            {/* Feature Layers */}
                            <section className="single-camadas-section">
                                <div className="single-section-title-row">
                                    <h5>Feature Layers</h5>
                                    <span className="single-section-badge">{featureServices.length}</span>
                                </div>
                                <div className="single-section-body">
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
                                </div>
                            </section>

                            {/* Grupos Drone */}
                            <section className="single-camadas-section">
                                <div className="single-section-title-row">
                                    <h5>Grupos Drone</h5>
                                    <span className="single-section-badge">{droneGroups.length}</span>
                                </div>

                                <div className="single-drone-group-list">
                                    {droneGroups.map((group) => {
                                        const latest = group.latestItem;
                                        const count = group.items.length;
                                        const isSelected = selectedDroneGroupKey === group.groupKey;

                                        return (
                                            <button
                                                key={group.groupKey}
                                                type="button"
                                                className={`single-drone-group-card ${isSelected ? "selected" : ""}`}
                                                onClick={() => {
                                                    setSelectedDroneGroupKey(group.groupKey);
                                                    setSelectedDroneDay(latest?.dayKey ?? null);
                                                }}
                                            >
                                                <div className="single-drone-group-card-top">
                                                    <span className="single-drone-group-name">
                                                        {group.pointName || group.pointKey || "Grupo sem nome"}
                                                    </span>
                                                    <span className="single-drone-group-count">
                                                        {count} {count === 1 ? "item" : "itens"}
                                                    </span>
                                                </div>

                                                <div className="single-drone-group-card-meta">
                                                    <span>
                                                        <strong>Data mais recente:</strong>{" "}
                                                        {latest?.dayKey || "Sem data"}
                                                    </span>
                                                </div>

                                                {isSelected && (
                                                    <div className="single-drone-group-extra">
                                                        <div className="single-drone-group-extra-item">
                                                            <strong>Centro:</strong>{" "}
                                                            {group.representativeCenter
                                                                ? `${formatCoord(group.representativeCenter.x)}, ${formatCoord(group.representativeCenter.y)}`
                                                                : "Não definido"}
                                                        </div>
                                                        <div className="single-drone-group-extra-item">
                                                            <strong>Último item:</strong>{" "}
                                                            {latest?.title || latest?.serviceName || "—"}
                                                        </div>
                                                    </div>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </section>

                            {/* Datas do grupo selecionado */}
                            {selectedDroneGroup && (
                                <section className="single-camadas-section">
                                    <div className="single-section-title-row">
                                        <h5>Datas do Grupo</h5>
                                        <span className="single-section-badge">{selectedGroupAvailableDays.length}</span>
                                    </div>

                                    <div className="single-selected-group-caption">
                                        {selectedDroneGroup.pointName || selectedDroneGroup.pointKey}
                                    </div>

                                    <div className="single-day-pill-list">
                                        {selectedGroupAvailableDays.map((day) => {
                                            const isSelected = selectedDroneDay === day;
                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    className={`single-day-pill ${isSelected ? "selected" : ""}`}
                                                    onClick={() => setSelectedDroneDay(day)}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            {/* Map Image Layers */}
                            <section className="single-camadas-section">
                                <div className="single-section-title-row">
                                    <h5>Map Image Layers</h5>
                                    <span className="single-section-badge">{mapImageLayers.length}</span>
                                </div>
                                <div className="single-section-body">
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
                            </section>
                        </aside>
                    </>
                ) : (
                    <p>Nenhum mosaico disponível</p>
                )}
            </section>
        </div>
    );
};

export default SingleMapPage;
