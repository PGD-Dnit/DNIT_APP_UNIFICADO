import React, { useEffect, useMemo, useRef, useState } from "react";
import TileSwipeViewer from "./TileSwipeViewer";
import FeatureServiceList from "./FeatureServiceList";
import DualTileMapsViewer from "./DualTileMapsViewer";

import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import MapImageLayer from "@arcgis/core/layers/MapImageLayer";
import MapView from "@arcgis/core/views/MapView";
import Viewpoint from "@arcgis/core/Viewpoint";

import "./SwipePage.css";
import { useAppStore } from "../../core/store";

import { buildPlanetTileUrl } from "../../core/mosaicUtils";
import { Setup360OnView } from "../imagem_360/Setup360OnView";
import { SetupImageOnView } from "../imagem_obra/SetupImageOnView";
import {
    type MapImageItem,
    groupDroneImages,
    formatCoord,
} from "../../core/droneUtils";
import { useMapLayersData } from "./useMapLayersData";
import { useDroneGroupAutoSelect } from "./useDroneGroupAutoSelect";




const SwipePage: React.FC = () => {
    const mosaics = useAppStore((s) => s.planetMosaics);
    const mosaicsLoading = useAppStore((s) => s.planetMosaicsLoading);
    const mosaicsError = useAppStore((s) => s.planetMosaicsError);
    const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);
    const setPlanetSelectedId = useAppStore((s) => s.setPlanetSelectedId);

    const droneLayersVisible = useAppStore((s) => s.droneLayersVisible);
    // const setDroneLayersVisible = useAppStore((s) => s.setDroneLayersVisible);
    // const image360LayersVisible = useAppStore((s) => s.image360LayersVisible);
    // const setImage360LayersVisible = useAppStore((s) => s.setImage360LayersVisible);
    // const imageObraLayersVisible = useAppStore((s) => s.imageObraLayersVisible);
    // const setImageObraLayersVisible = useAppStore((s) => s.setImageObraLayersVisible);

    const [leftMosaicId, setLeftMosaicId] = useState<string | null>(null);
    const [rightMosaicId, setRightMosaicId] = useState<string | null>(null);

    const {
        featureServices,
        loadingFeatures,
        erro,
        mapImageLayers,
        mapImageLayersLoading,
        mapImageLayersError
    } = useMapLayersData();

    const [mapReady, setMapReady] = useState(false);
    const showCamadas = useAppStore((s) => s.showCamadas);
    const setShowCamadas = useAppStore((s) => s.setShowCamadas);
    const dualMode = useAppStore((s) => s.dualMode);
    // const setDualModeStore = useAppStore((s) => s.setDualMode);
    const storeLastViewpoint = useAppStore((s) => s.lastViewpoint);
    // const setStoreLastViewpoint = useAppStore((s) => s.setLastViewpoint);

    const lastViewpointRef = useRef<Viewpoint | null>(null);

    const swipeViewRef = useRef<MapView | null>(null);
    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    const swipeSetupCleanupRef = useRef<null | (() => void)>(null);
    const leftSetupCleanupRef = useRef<null | (() => void)>(null);
    const rightSetupCleanupRef = useRef<null | (() => void)>(null);
    const autoSelectCleanupRef = useRef<null | (() => void)>(null);

    const swipeInitTokenRef = useRef(0);
    const leftInitTokenRef = useRef(0);
    const rightInitTokenRef = useRef(0);

    const [activeFeatureUrls, setActiveFeatureUrls] = useState<string[]>([]);
    const [activeMapImageUrls, setActiveMapImageUrls] = useState<string[]>([]);

    const [selectedDroneGroupKey, setSelectedDroneGroupKey] = useState<string | null>(null);
    const [selectedLeftDroneDay, setSelectedLeftDroneDay] = useState<string | null>(null);
    const [selectedRightDroneDay, setSelectedRightDroneDay] = useState<string | null>(null);
    const swipeWidgetRef = useRef<__esri.Swipe | null>(null);

    // Efeito para sincronizar e limpar viewpoint quando dualMode muda no store
    const prevDualModeRef = useRef(dualMode);
    useEffect(() => {
        if (dualMode === prevDualModeRef.current) return;

        if (dualMode) {
            // Entrando no DualMode
            if (swipeViewRef.current?.viewpoint) {
                lastViewpointRef.current = swipeViewRef.current.viewpoint.clone();
            }

            swipeInitTokenRef.current += 1;
            swipeSetupCleanupRef.current?.();
            swipeSetupCleanupRef.current = null;
        } else {
            // Saindo do DualMode
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
        prevDualModeRef.current = dualMode;
    }, [dualMode]);

    // Sincronizar viewpoint do store com ref local ao montar
    useEffect(() => {
        if (storeLastViewpoint) {
            lastViewpointRef.current = storeLastViewpoint.clone();
        }
    }, []);

    // Toggle visibilidade das camadas drone (map-image-*) quando o store mudar
    useEffect(() => {
        const views = getActiveViews();
        views.forEach((view) => {
            view.map?.layers.forEach((layer: any) => {
                if (typeof layer.id === "string" && layer.id.startsWith("map-image-")) {
                    layer.visible = droneLayersVisible;
                }
            });
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [droneLayersVisible]);

    useEffect(() => {
        const handler = (event: PromiseRejectionEvent) => {
            const r = event.reason;
            if (
                r &&
                (r.name === "AbortError" ||
                    r.name === "cancelled:layerview-create" ||
                    r.message?.includes("AbortError") ||
                    r.message?.includes("layerview creation cancelled"))
            ) {
                event.preventDefault();
            }
        };
        window.addEventListener("unhandledrejection", handler);
        return () => window.removeEventListener("unhandledrejection", handler);
    }, []);

    useEffect(() => {
        loadPlanetMosaics();
    }, [loadPlanetMosaics]);

    useEffect(() => {
        if (!mosaics.length) return;

        if (!leftMosaicId) {
            setLeftMosaicId(mosaics[0].id);
            setPlanetSelectedId(mosaics[0].id);
        }

        if (!rightMosaicId) {
            setRightMosaicId(mosaics[0].id);
        }

        console.log(
            "🔍 [DEBUG] Mosaicos carregados da API:",
            mosaics.map((m) => ({
                id: m.id,
                when: m.when,
                label: (m as any).label,
            }))
        );
    }, [mosaics, leftMosaicId, rightMosaicId, setPlanetSelectedId]);



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

            autoSelectCleanupRef.current?.();
            autoSelectCleanupRef.current = null;
        };
    }, []);

    const droneDateFilter = useAppStore((s) => s.droneDateFilter);

    const filteredMapImageLayers = useMemo(() => {
        if (!droneDateFilter.start && !droneDateFilter.end) {
            return mapImageLayers;
        }
        return mapImageLayers.filter(layer => {
            if (!layer.sourceDateMs) return false; // Hide items with unknown dates if a filter is active
            const d = layer.sourceDateMs;
            if (droneDateFilter.start && d < droneDateFilter.start) return false;
            if (droneDateFilter.end && d > droneDateFilter.end) return false;
            return true;
        });
    }, [mapImageLayers, droneDateFilter]);

    const droneGroups = useMemo(() => {
        return groupDroneImages(filteredMapImageLayers);
    }, [filteredMapImageLayers]);

    const droneGroupsMap = useMemo(() => {
        return new Map(droneGroups.map((g) => [g.groupKey, g]));
    }, [droneGroups]);

    const latestMapImageByGroup = useMemo(() => {
        return droneGroups
            .map((g) => g.latestItem)
            .filter((item): item is MapImageItem => !!item);
    }, [droneGroups]);

    const selectedDroneGroup = useMemo(() => {
        return selectedDroneGroupKey ? droneGroupsMap.get(selectedDroneGroupKey) ?? null : null;
    }, [selectedDroneGroupKey, droneGroupsMap]);

    /* ── Auto-seleção pelo extent da view ── */
    const { setupAutoSelect } = useDroneGroupAutoSelect({
        droneGroups,
        selectedGroupKey: selectedDroneGroupKey,
        onSelectGroup: (groupKey, dayKey) => {
            setSelectedDroneGroupKey(groupKey);
            setSelectedLeftDroneDay(dayKey);
            setSelectedRightDroneDay(dayKey);
        },
    });

    const activeGroupDroneDatesSet = useMemo(() => {
        const dates = new Set<string>();
        if (selectedDroneGroup) {
            selectedDroneGroup.items.forEach((item) => {
                if (item.dayKey) dates.add(item.dayKey);
            });
        }
        return dates;
    }, [selectedDroneGroup]);

    const selectedGroupAvailableDays = useMemo(() => {
        if (!selectedDroneGroup) return [];

        const unique = new Set(
            selectedDroneGroup.items
                .map((item) => item.dayKey)
                .filter((d): d is string => !!d)
        );

        return Array.from(unique).sort((a, b) => b.localeCompare(a));
    }, [selectedDroneGroup]);

    useEffect(() => {
        if (!droneGroups.length) return;

        if (!selectedDroneGroupKey || !droneGroupsMap.has(selectedDroneGroupKey)) {
            const firstGroup = droneGroups[0];
            setSelectedDroneGroupKey(firstGroup.groupKey);
            setSelectedLeftDroneDay(firstGroup.latestItem?.dayKey ?? null);
            setSelectedRightDroneDay(firstGroup.latestItem?.dayKey ?? null);
        }
    }, [droneGroups, droneGroupsMap, selectedDroneGroupKey]);

    useEffect(() => {
        if (!selectedDroneGroup) return;

        let leftOk = false;
        let rightOk = false;

        if (
            selectedLeftDroneDay &&
            selectedDroneGroup.items.some((item) => item.dayKey === selectedLeftDroneDay)
        ) {
            leftOk = true;
        }

        if (
            selectedRightDroneDay &&
            selectedDroneGroup.items.some((item) => item.dayKey === selectedRightDroneDay)
        ) {
            rightOk = true;
        }

        if (!leftOk) setSelectedLeftDroneDay(selectedDroneGroup.latestItem?.dayKey ?? null);
        if (!rightOk) setSelectedRightDroneDay(selectedDroneGroup.latestItem?.dayKey ?? null);
    }, [selectedDroneGroup, selectedLeftDroneDay, selectedRightDroneDay]);

    const getActiveViews = (): MapView[] => {
        if (dualMode) {
            const views: MapView[] = [];
            if (leftViewRef.current) views.push(leftViewRef.current);
            if (rightViewRef.current) views.push(rightViewRef.current);
            return views;
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
                const cleanup360 = Setup360OnView(view);
                const cleanupObra = SetupImageOnView(view);
                cleanupRef.current = () => {
                    cleanup360();
                    cleanupObra();
                };
            })
            .catch((err) => {
                console.error(`view.when() falhou no SwipePage (${label}):`, err);
            });
    };

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

    const removeAllDroneLayersFromViews = (views: MapView[]) => {
        views.forEach((view) => {
            const layers = view.map?.layers.toArray() || [];

            layers.forEach((layer: any) => {
                if (
                    layer?.id &&
                    typeof layer.id === "string" &&
                    layer.id.startsWith("map-image-")
                ) {
                    if (swipeWidgetRef.current && views.length === 1) {
                        try {
                            swipeWidgetRef.current.leadingLayers.remove(layer);
                            swipeWidgetRef.current.trailingLayers.remove(layer);
                        } catch { }
                    }

                    view.map?.remove(layer);
                }
            });
        });
    };

    const addMapImageLayerToViews = (
        views: MapView[],
        item: MapImageItem,
        side: "left" | "right" | "both" = "both"
    ) => {
        if (!item.url) return;

        const layerId = `map-image-${item.url}`;

        views.forEach((view) => {
            const already = view.map?.findLayerById(layerId) as __esri.MapImageLayer | null;
            let layer = already;

            if (!layer) {
                layer = new MapImageLayer({
                    url: item.url,
                    id: layerId,
                });

                const layers = view.map?.layers.toArray() || [];
                const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;

                view.map?.add(layer, insertIndex);
            }

            if (swipeWidgetRef.current && views.length === 1 && layer) {
                const inLeading = swipeWidgetRef.current.leadingLayers.includes(layer);
                const inTrailing = swipeWidgetRef.current.trailingLayers.includes(layer);

                if (side === "left" && !inLeading) {
                    swipeWidgetRef.current.leadingLayers.add(layer);
                } else if (side === "right" && !inTrailing) {
                    swipeWidgetRef.current.trailingLayers.add(layer);
                }
            }
        });
    };

    const applyDefaultLatestMapImageLayersToViews = async (views: MapView[]) => {
        if (!views.length) return;

        removeAllDroneLayersFromViews(views);

        const uniqueUrls = new Set<string>();

        latestMapImageByGroup.forEach((item) => {
            addMapImageLayerToViews(views, item);
            uniqueUrls.add(item.url);
        });

        setActiveMapImageUrls(Array.from(uniqueUrls));
    };

    const applyDroneSelectionToViews = async (
        views: MapView[],
        groupKey: string | null,
        leftDayKey: string | null,
        rightDayKey: string | null
    ) => {
        if (!views.length) return;

        if (!groupKey) {
            await applyDefaultLatestMapImageLayersToViews(views);
            return;
        }

        const group = droneGroupsMap.get(groupKey);
        if (!group) {
            await applyDefaultLatestMapImageLayersToViews(views);
            return;
        }

        const leftItems = leftDayKey
            ? group.items.filter((item) => item.dayKey === leftDayKey)
            : group.latestItem
                ? [group.latestItem]
                : [];

        const rightItems = rightDayKey
            ? group.items.filter((item) => item.dayKey === rightDayKey)
            : group.latestItem
                ? [group.latestItem]
                : [];

        const latestOtherGroups = latestMapImageByGroup.filter(
            (item) => !group.items.some((gItem) => gItem.id === item.id)
        );

        removeAllDroneLayersFromViews(views);

        const uniqueUrls = new Set<string>();

        if (views.length === 2) {
            leftItems.forEach((item) => {
                addMapImageLayerToViews([views[0]], item, "left");
                uniqueUrls.add(item.url);
            });

            rightItems.forEach((item) => {
                addMapImageLayerToViews([views[1]], item, "right");
                uniqueUrls.add(item.url);
            });

            latestOtherGroups.forEach((item) => {
                addMapImageLayerToViews(views, item, "both");
                uniqueUrls.add(item.url);
            });
        } else if (views.length === 1) {
            const view = views[0];

            leftItems.forEach((item) => {
                addMapImageLayerToViews([view], item, "left");
                uniqueUrls.add(item.url);
            });

            rightItems.forEach((item) => {
                addMapImageLayerToViews([view], item, "right");
                uniqueUrls.add(item.url);
            });

            latestOtherGroups.forEach((item) => {
                addMapImageLayerToViews([view], item, "both");
                uniqueUrls.add(item.url);
            });
        }

        setActiveMapImageUrls(Array.from(uniqueUrls));
    };

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
                    if (swipeWidgetRef.current && views.length === 1) {
                        try {
                            swipeWidgetRef.current.leadingLayers.remove(toRemove as any);
                            swipeWidgetRef.current.trailingLayers.remove(toRemove as any);
                        } catch { }
                    }

                    view.map?.remove(toRemove);
                }
            });

            setActiveMapImageUrls((prev) => prev.filter((u) => u !== layerUrl));
        }
    };

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
    };

    const reapplyActiveMapImageLayers = (views: MapView[]) => {
        activeMapImageUrls.forEach((url) => {
            const layerId = `map-image-${url}`;

            views.forEach((view) => {
                const already = view.map?.findLayerById(layerId);

                if (!already) {
                    const layer = new MapImageLayer({
                        url,
                        id: layerId,
                    });

                    const layers = view.map?.layers.toArray() || [];
                    const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                    const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;

                    view.map?.add(layer, insertIndex);
                }
            });
        });
    };

    useEffect(() => {
        const views = getActiveViews();
        if (!views.length || !mapReady) return;

        applyDroneSelectionToViews(
            views,
            selectedDroneGroupKey,
            selectedLeftDroneDay,
            selectedRightDroneDay
        );
    }, [
        mapReady,
        dualMode,
        selectedDroneGroupKey,
        selectedLeftDroneDay,
        selectedRightDroneDay,
        latestMapImageByGroup,
        droneGroupsMap,
    ]);

    const handleDroneDateClick = (side: "left" | "right", dayKey: string) => {
        const views = getActiveViews();
        if (!views.length) return;

        const matchingGroup = droneGroups.find((g) =>
            g.items.some((item) => item.dayKey === dayKey)
        );

        const groupKey = matchingGroup?.groupKey ?? null;
        setSelectedDroneGroupKey(groupKey);

        const nextLeftDay = side === "left" ? dayKey : selectedLeftDroneDay;
        const nextRightDay = side === "right" ? dayKey : selectedRightDroneDay;

        if (side === "left") setSelectedLeftDroneDay(dayKey);
        else setSelectedRightDroneDay(dayKey);

        applyDroneSelectionToViews(views, groupKey, nextLeftDay, nextRightDay);
    };

    if (mosaicsLoading || loadingFeatures || mapImageLayersLoading) {
        return <p>Carregando…</p>;
    }

    if (mosaicsError) return <p>{mosaicsError}</p>;
    if (erro) return <p>{erro}</p>;
    if (mapImageLayersError) return <p>{mapImageLayersError}</p>;

    const left = mosaics.find((m) => m.id === leftMosaicId);
    const right = mosaics.find((m) => m.id === rightMosaicId) || left;

    const leftUrl = left
        ? buildPlanetTileUrl(left.id)
        : "";

    const rightUrl = right
        ? buildPlanetTileUrl(right.id)
        : "";


    const titleLeft = left?.when
        ? (() => {
            const match3 = left.when.match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
            if (match3) return `${match3[3]}/${match3[2]}/${match3[1]}`;

            const match2 = left.when.match(/(\d{4})[-_/\.](\d{2})/);
            if (match2) {
                const y = parseInt(match2[1], 10);
                const mo = parseInt(match2[2], 10);
                const endD = String(new Date(y, mo, 0).getDate()).padStart(2, "0");
                return `${endD}/${match2[2]}/${match2[1]}`;
            }

            return left.when;
        })()
        : "?";

    const titleRight = right?.when
        ? (() => {
            const match3 = right.when.match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
            if (match3) return `${match3[3]}/${match3[2]}/${match3[1]}`;

            const match2 = right.when.match(/(\d{4})[-_/\.](\d{2})/);
            if (match2) {
                const y = parseInt(match2[1], 10);
                const mo = parseInt(match2[2], 10);
                const endD = String(new Date(y, mo, 0).getDate()).padStart(2, "0");
                return `${endD}/${match2[2]}/${match2[1]}`;
            }

            return right.when;
        })()
        : "?";

    return (
        <div id="webmap-container">
            <section id="mapa">

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
                                droneDates={activeGroupDroneDatesSet}
                                onDroneDateClick={handleDroneDateClick}
                                onMosaicChange={(side, mosaicId) => {
                                    if (side === "left") {
                                        setLeftMosaicId(mosaicId);
                                        setPlanetSelectedId(mosaicId);
                                    } else {
                                        setRightMosaicId(mosaicId);
                                    }
                                }}
                                onViewReady={async (view, swipeWidget) => {
                                    swipeViewRef.current = view;
                                    swipeWidgetRef.current = swipeWidget;
                                    leftViewRef.current = null;
                                    rightViewRef.current = null;

                                    reapplyActiveLayers([view]);
                                    reapplyActiveMapImageLayers([view]);

                                    await applyDroneSelectionToViews(
                                        [view],
                                        selectedDroneGroupKey,
                                        selectedLeftDroneDay,
                                        selectedRightDroneDay
                                    );

                                    /* Auto-seleção de grupo pelo extent da view (modo swipe) */
                                    autoSelectCleanupRef.current?.();
                                    autoSelectCleanupRef.current = setupAutoSelect(view);

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
                                mosaics={mosaics}
                                titleLeft={titleLeft}
                                titleRight={titleRight}
                                initialViewpoint={lastViewpointRef.current || undefined}
                                droneDates={activeGroupDroneDatesSet}
                                onDroneDateClick={handleDroneDateClick}
                                onMosaicChange={(side, mosaicId) => {
                                    if (side === "left") {
                                        setLeftMosaicId(mosaicId);
                                        setPlanetSelectedId(mosaicId);
                                    } else {
                                        setRightMosaicId(mosaicId);
                                    }

                                    const views = getActiveViews();
                                    if (views.length) {
                                        applyDroneSelectionToViews(
                                            views,
                                            selectedDroneGroupKey,
                                            selectedLeftDroneDay,
                                            selectedRightDroneDay
                                        );
                                    }
                                }}
                                onViewsReady={async ({ leftView, rightView }) => {
                                    swipeViewRef.current = null;
                                    leftViewRef.current = leftView;
                                    rightViewRef.current = rightView;

                                    reapplyActiveLayers([leftView, rightView]);
                                    reapplyActiveMapImageLayers([leftView, rightView]);

                                    await applyDroneSelectionToViews(
                                        [leftView, rightView],
                                        selectedDroneGroupKey,
                                        selectedLeftDroneDay,
                                        selectedRightDroneDay
                                    );

                                    /* Auto-seleção de grupo pelo extent da view (modo dual — usa leftView como referência) */
                                    autoSelectCleanupRef.current?.();
                                    autoSelectCleanupRef.current = setupAutoSelect(leftView);

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

                        <aside className={`camadas ${showCamadas ? "aberta" : "fechada"}`}>
                            <div className="camadas-header">
                                <div className="camadas-header-text">
                                    <h4>Painel de Camadas</h4>
                                    <span className="camadas-subtitle">
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

                            <section className="camadas-section">
                                <div className="section-title-row">
                                    <h5>Feature Layers</h5>
                                    <span className="section-badge">{featureServices.length}</span>
                                </div>

                                <div className="section-body">
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

                            <section className="camadas-section">
                                <div className="section-title-row">
                                    <h5>Grupos Drone</h5>
                                    <span className="section-badge">{droneGroups.length}</span>
                                </div>

                                <div className="drone-group-list">
                                    {droneGroups.map((group) => {
                                        const latest = group.latestItem;
                                        const count = group.items.length;
                                        const isSelected = selectedDroneGroupKey === group.groupKey;

                                        return (
                                            <button
                                                key={group.groupKey}
                                                type="button"
                                                className={`drone-group-card ${isSelected ? "selected" : ""}`}
                                                onClick={() => {
                                                    setSelectedDroneGroupKey(group.groupKey);
                                                    setSelectedLeftDroneDay(latest?.dayKey ?? null);
                                                    setSelectedRightDroneDay(latest?.dayKey ?? null);
                                                }}
                                            >
                                                <div className="drone-group-card-top">
                                                    <span className="drone-group-name">
                                                        {group.pointName || group.pointKey || "Grupo sem nome"}
                                                    </span>

                                                    <span className="drone-group-count">
                                                        {count} {count === 1 ? "item" : "itens"}
                                                    </span>
                                                </div>

                                                <div className="drone-group-card-meta">
                                                    <span>
                                                        <strong>Data mais recente:</strong>{" "}
                                                        {latest?.dayKey || "Sem data"}
                                                    </span>
                                                </div>

                                                <div className="drone-group-card-meta">
                                                    <span>
                                                        <strong>Chave:</strong> {group.pointKey || "—"}
                                                    </span>
                                                </div>

                                                {isSelected && (
                                                    <div className="drone-group-extra">
                                                        <div className="drone-group-extra-item">
                                                            <strong>Centro:</strong>{" "}
                                                            {group.representativeCenter
                                                                ? `${formatCoord(group.representativeCenter.x)}, ${formatCoord(group.representativeCenter.y)}`
                                                                : "Não definido"}
                                                        </div>
                                                        <div className="drone-group-extra-item">
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

                            {selectedDroneGroup && (
                                <section className="camadas-section">
                                    <div className="section-title-row">
                                        <h5>Datas do Grupo</h5>
                                        <span className="section-badge">
                                            {selectedGroupAvailableDays.length}
                                        </span>
                                    </div>

                                    <div className="selected-group-caption">
                                        {selectedDroneGroup.pointName || selectedDroneGroup.pointKey}
                                    </div>

                                    <div className="day-pill-list">
                                        {selectedGroupAvailableDays.map((day) => {
                                            const isSelected =
                                                selectedLeftDroneDay === day ||
                                                selectedRightDroneDay === day;

                                            return (
                                                <button
                                                    key={day}
                                                    type="button"
                                                    className={`day-pill ${isSelected ? "selected" : ""}`}
                                                    onClick={() => {
                                                        setSelectedLeftDroneDay(day);
                                                        setSelectedRightDroneDay(day);
                                                    }}
                                                >
                                                    {day}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </section>
                            )}

                            <section className="camadas-section">
                                <div className="section-title-row">
                                    <h5>Map Image Layers</h5>
                                    <span className="section-badge">{mapImageLayers.length}</span>
                                </div>

                                <div className="section-body">
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
                    <p>Selecione dois mosaicos para comparar</p>
                )}
            </section>
        </div>
    );
};

export default SwipePage;