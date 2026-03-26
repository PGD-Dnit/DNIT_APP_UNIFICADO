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
import { CONFIG } from "../../core/config";
import { Setup360OnView } from "../imagem_360/Setup360OnView";

type LayerItem = {
    id: string;
    title: string;
    url: string;
};

type ExtentBox = {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    wkid?: number;
};

type CenterPoint = {
    x: number;
    y: number;
    wkid?: number;
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

    serviceName?: string | null;
    rawServiceName?: string | null;
    pointName?: string | null;
    pointKey?: string | null;
    dayKey?: string | null;
    sourceDateMs?: number | null;

    fullExtent?: ExtentBox | null;
    initialExtent?: ExtentBox | null;
    center?: CenterPoint | null;
    areaM2?: number | null;
};

type DroneGroup = {
    groupKey: string;
    pointKey: string;
    pointName: string;
    items: MapImageItem[];
    latestItem: MapImageItem | null;
    representativeCenter: CenterPoint | null;
    representativeExtent: ExtentBox | null;
};

const STRONG_OVERLAP_THRESHOLD = 0.6;
const OVERLAP_THRESHOLD = 0.3;
const CENTER_DISTANCE_METERS = 200;
const NAME_DISTANCE_METERS = 80;

const safeNum = (v: any): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

const normalizePointKey = (value: string): string => {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\.(tif|tiff)$/gi, "")
        .replace(/_tif$/gi, "")
        .replace(/-tif$/gi, "")
        .replace(/[_\s]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();
};

const parseDatePartsToDayKey = (yearRaw: string, monthRaw: string, dayRaw: string) => {
    const yearNum = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const monthNum = Number(monthRaw);
    const dayNum = Number(dayRaw);

    const d = new Date(yearNum, monthNum - 1, dayNum);
    const valid =
        d.getFullYear() === yearNum &&
        d.getMonth() === monthNum - 1 &&
        d.getDate() === dayNum;

    if (!valid) {
        return {
            dayKey: null,
            sourceDateMs: null,
        };
    }

    return {
        dayKey: `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
        sourceDateMs: d.getTime(),
    };
};

/**
 * Exemplos aceitos:
 * Ponte_Autaz_Mirim_03_03_26_tif
 * Ponte_autaz_mirim_20_02_2026_tif
 * drone_formosa_02_09_2025
 */
const parseDroneServiceName = (serviceName: string) => {
    const cleaned = serviceName
        .trim()
        .replace(/\/+$/, "")
        .replace(/\.(tif|tiff)$/i, "")
        .replace(/_tif$/i, "")
        .replace(/-tif$/i, "");

    const regex = /^(.*?)[_-](\d{2})[_-](\d{2})[_-](\d{2}|\d{4})$/i;
    const match = cleaned.match(regex);

    if (!match) {
        return {
            rawServiceName: cleaned,
            pointName: cleaned || null,
            pointKey: cleaned ? normalizePointKey(cleaned) : null,
            dayKey: null,
            sourceDateMs: null,
        };
    }

    const [, rawPointName, dd, mm, yyyyOrYY] = match;
    const parsedDate = parseDatePartsToDayKey(yyyyOrYY, mm, dd);

    return {
        rawServiceName: cleaned,
        pointName: rawPointName || null,
        pointKey: rawPointName ? normalizePointKey(rawPointName) : null,
        dayKey: parsedDate.dayKey,
        sourceDateMs: parsedDate.sourceDateMs,
    };
};

const parseExtent = (raw: any): ExtentBox | null => {
    if (!raw || typeof raw !== "object") return null;

    const xmin = safeNum(raw.xmin ?? raw.XMin);
    const ymin = safeNum(raw.ymin ?? raw.YMin);
    const xmax = safeNum(raw.xmax ?? raw.XMax);
    const ymax = safeNum(raw.ymax ?? raw.YMax);

    if (
        xmin == null ||
        ymin == null ||
        xmax == null ||
        ymax == null ||
        xmax <= xmin ||
        ymax <= ymin
    ) {
        return null;
    }

    const wkid =
        safeNum(raw?.spatialReference?.wkid) ??
        safeNum(raw?.spatialReference?.latestWkid) ??
        safeNum(raw?.wkid) ??
        undefined;

    return { xmin, ymin, xmax, ymax, wkid };
};

const getExtentCenter = (extent: ExtentBox | null | undefined): CenterPoint | null => {
    if (!extent) return null;

    return {
        x: (extent.xmin + extent.xmax) / 2,
        y: (extent.ymin + extent.ymax) / 2,
        wkid: extent.wkid,
    };
};

const getExtentArea = (extent: ExtentBox | null | undefined): number | null => {
    if (!extent) return null;

    const width = extent.xmax - extent.xmin;
    const height = extent.ymax - extent.ymin;

    if (width <= 0 || height <= 0) return null;

    return width * height;
};

const distanceMeters = (
    a: CenterPoint | null | undefined,
    b: CenterPoint | null | undefined
): number | null => {
    if (!a || !b) return null;

    const dx = a.x - b.x;
    const dy = a.y - b.y;

    return Math.sqrt(dx * dx + dy * dy);
};

const getIntersectionArea = (
    a: ExtentBox | null | undefined,
    b: ExtentBox | null | undefined
): number => {
    if (!a || !b) return 0;

    const ixmin = Math.max(a.xmin, b.xmin);
    const iymin = Math.max(a.ymin, b.ymin);
    const ixmax = Math.min(a.xmax, b.xmax);
    const iymax = Math.min(a.ymax, b.ymax);

    if (ixmax <= ixmin || iymax <= iymin) return 0;

    return (ixmax - ixmin) * (iymax - iymin);
};

const getIntersectionPctOnSmaller = (
    a: ExtentBox | null | undefined,
    b: ExtentBox | null | undefined
): number => {
    const areaA = getExtentArea(a);
    const areaB = getExtentArea(b);

    if (!areaA || !areaB) return 0;

    const minArea = Math.min(areaA, areaB);
    if (!minArea) return 0;

    return getIntersectionArea(a, b) / minArea;
};

const averageCenters = (items: MapImageItem[]): CenterPoint | null => {
    const centers = items
        .map((i) => i.center)
        .filter((c): c is CenterPoint => !!c);

    if (!centers.length) return null;

    const sum = centers.reduce(
        (acc, c) => {
            acc.x += c.x;
            acc.y += c.y;
            return acc;
        },
        { x: 0, y: 0 }
    );

    return {
        x: sum.x / centers.length,
        y: sum.y / centers.length,
        wkid: centers[0].wkid,
    };
};

const namesLookEquivalent = (a?: string | null, b?: string | null) => {
    if (!a || !b) return false;
    return normalizePointKey(a) === normalizePointKey(b);
};

const buildSimilarity = (a: MapImageItem, b: MapImageItem) => {
    const overlapPct = getIntersectionPctOnSmaller(a.fullExtent, b.fullExtent);
    const centerDist = distanceMeters(a.center, b.center);
    const sameLogicalName =
        namesLookEquivalent(a.pointKey, b.pointKey) ||
        namesLookEquivalent(a.pointName, b.pointName) ||
        namesLookEquivalent(a.rawServiceName, b.rawServiceName) ||
        namesLookEquivalent(a.serviceName, b.serviceName);

    const strongOverlap = overlapPct >= STRONG_OVERLAP_THRESHOLD;
    const overlapAndNear =
        overlapPct >= OVERLAP_THRESHOLD &&
        centerDist != null &&
        centerDist <= CENTER_DISTANCE_METERS;

    const nearAndSameName =
        centerDist != null &&
        centerDist <= NAME_DISTANCE_METERS &&
        sameLogicalName;

    const isSameGroup = strongOverlap || overlapAndNear || nearAndSameName;

    return {
        overlapPct,
        centerDist,
        sameLogicalName,
        strongOverlap,
        overlapAndNear,
        nearAndSameName,
        isSameGroup,
    };
};

const itemsAreSameSpatialGroup = (
    candidate: MapImageItem,
    groupItems: MapImageItem[]
): boolean => {
    if (!groupItems.length) return false;

    return groupItems.some((existing) => buildSimilarity(candidate, existing).isSameGroup);
};

const inferGroupLabel = (items: MapImageItem[]) => {
    const names = items
        .map((i) => i.pointName || i.pointKey || i.rawServiceName || i.serviceName)
        .filter((v): v is string => !!v);

    if (!names.length) return "grupo-drone";

    const normalized = names.map((n) => normalizePointKey(n));
    const counts = new Map<string, number>();

    normalized.forEach((n) => {
        counts.set(n, (counts.get(n) || 0) + 1);
    });

    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner || "grupo-drone";
};

const groupDroneImages = (items: MapImageItem[]): DroneGroup[] => {
    const sorted = [...items].sort((a, b) => {
        const aTime = a.sourceDateMs ?? 0;
        const bTime = b.sourceDateMs ?? 0;
        return bTime - aTime;
    });

    const spatialBuckets: MapImageItem[][] = [];

    sorted.forEach((item) => {
        let matchedBucket: MapImageItem[] | null = null;

        for (const bucket of spatialBuckets) {
            if (itemsAreSameSpatialGroup(item, bucket)) {
                matchedBucket = bucket;
                break;
            }
        }

        if (matchedBucket) {
            matchedBucket.push(item);
        } else {
            spatialBuckets.push([item]);
        }
    });

    const groups = spatialBuckets.map((bucket, index) => {
        const bucketSorted = [...bucket].sort((a, b) => {
            const aTime = a.sourceDateMs ?? 0;
            const bTime = b.sourceDateMs ?? 0;
            return bTime - aTime;
        });

        const latestItem = bucketSorted[0] ?? null;
        const representativeCenter = averageCenters(bucketSorted);
        const representativeExtent = latestItem?.fullExtent ?? null;

        const inferredPointKey = inferGroupLabel(bucketSorted);

        return {
            groupKey: `${inferredPointKey}__${index + 1}`,
            pointKey: inferredPointKey,
            pointName:
                latestItem?.pointName ||
                latestItem?.pointKey ||
                latestItem?.rawServiceName ||
                latestItem?.serviceName ||
                inferredPointKey,
            items: bucketSorted,
            latestItem,
            representativeCenter,
            representativeExtent,
        };
    });

    return groups.sort((a, b) => {
        const aTime = a.latestItem?.sourceDateMs ?? 0;
        const bTime = b.latestItem?.sourceDateMs ?? 0;
        return bTime - aTime;
    });
};

const SwipePage: React.FC = () => {
    const mosaics = useAppStore((s) => s.planetMosaics);
    const mosaicsLoading = useAppStore((s) => s.planetMosaicsLoading);
    const mosaicsError = useAppStore((s) => s.planetMosaicsError);
    const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);
    const setPlanetSelectedId = useAppStore((s) => s.setPlanetSelectedId);

    const [leftMosaicId, setLeftMosaicId] = useState<string | null>(null);
    const [rightMosaicId, setRightMosaicId] = useState<string | null>(null);

    const [featureServices, setFeatureServices] = useState<LayerItem[]>([]);
    const [erro, setErro] = useState<string | null>(null);
    const [loadingFeatures, setLoadingFeatures] = useState(true);

    const [mapReady, setMapReady] = useState(false);
    const [showCamadas, setShowCamadas] = useState(false);
    const [dualMode, setDualMode] = useState(false);

    const lastViewpointRef = useRef<Viewpoint | null>(null);

    const swipeViewRef = useRef<MapView | null>(null);
    const leftViewRef = useRef<MapView | null>(null);
    const rightViewRef = useRef<MapView | null>(null);

    const swipeSetupCleanupRef = useRef<null | (() => void)>(null);
    const leftSetupCleanupRef = useRef<null | (() => void)>(null);
    const rightSetupCleanupRef = useRef<null | (() => void)>(null);

    const swipeInitTokenRef = useRef(0);
    const leftInitTokenRef = useRef(0);
    const rightInitTokenRef = useRef(0);

    const [activeFeatureUrls, setActiveFeatureUrls] = useState<string[]>([]);
    const [activeMapImageUrls, setActiveMapImageUrls] = useState<string[]>([]);

    const [mapImageLayers, setMapImageLayers] = useState<MapImageItem[]>([]);
    const [mapImageLayersLoading, setMapImageLayersLoading] = useState(true);
    const [mapImageLayersError, setMapImageLayersError] = useState<string | null>(null);

    const [selectedDroneGroupKey, setSelectedDroneGroupKey] = useState<string | null>(null);
    const [selectedDroneDay, setSelectedDroneDay] = useState<string | null>(null);

    // 🗓️ Todas as datas drone visíveis no calendário (globalmente, sem filtro de raio)

    // 🛑 Supressão inofensiva de erros crônicos de Hot-Reload do ArcGIS JS no React
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
            setRightMosaicId((mosaics[0] || mosaics[0]).id);
        }

        // --- Console log para depuração ---
        console.log("🔍 [DEBUG] Mosaicos carregados da API:", mosaics.map(m => ({
            id: m.id,
            when: m.when,
            label: (m as any).label
        })));
    }, [mosaics, leftMosaicId, rightMosaicId, setPlanetSelectedId]);

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

                const parsedItems: MapImageItem[] = items
                    .filter((item: any) => item.serviceUrl || item.url)
                    .map((item: any) => {
                        const rawServiceName =
                            String(item?.serviceName ?? "").trim() ||
                            String(item?.title ?? "").trim() ||
                            null;

                        const parsedName = rawServiceName
                            ? parseDroneServiceName(rawServiceName)
                            : {
                                rawServiceName: null,
                                pointName: null,
                                pointKey: null,
                                dayKey: null,
                                sourceDateMs: null,
                            };

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
                setMapImageLayersError(
                    e instanceof Error ? e.message : "Erro ao carregar Map Image Layers"
                );
            } finally {
                setMapImageLayersLoading(false);
            }
        };

        fetchMapImageLayers();
    }, []);

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

    const droneGroups = useMemo(() => {
        return groupDroneImages(mapImageLayers);
    }, [mapImageLayers]);

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

    // 🗓️ Datas de drone do grupo atualmente selecionado (respeitando a região da obra)
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

    // (O watcher de proximidade foi removido. Agora todas as datas drone acendem no calendário)


    useEffect(() => {
        if (!droneGroups.length) return;

        if (!selectedDroneGroupKey || !droneGroupsMap.has(selectedDroneGroupKey)) {
            const firstGroup = droneGroups[0];
            setSelectedDroneGroupKey(firstGroup.groupKey);
            setSelectedDroneDay(firstGroup.latestItem?.dayKey ?? null);
        }
    }, [droneGroups, droneGroupsMap, selectedDroneGroupKey]);

    useEffect(() => {
        if (!selectedDroneGroup) return;

        const hasDay =
            selectedDroneDay &&
            selectedDroneGroup.items.some((item) => item.dayKey === selectedDroneDay);

        if (!hasDay) {
            setSelectedDroneDay(selectedDroneGroup.latestItem?.dayKey ?? null);
        }
    }, [selectedDroneGroup, selectedDroneDay]);

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
                cleanupRef.current = Setup360OnView(view);
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
                    view.map?.remove(layer);
                }
            });
        });
    };

    const addMapImageLayerToViews = (views: MapView[], item: MapImageItem) => {
        if (!item.url) return;

        const layerId = `map-image-${item.url}`;

        views.forEach((view) => {
            const already = view.map?.findLayerById(layerId);

            if (!already) {
                const layer = new MapImageLayer({
                    url: item.url,
                    id: layerId,
                });

                const layers = view.map?.layers.toArray() || [];
                const firstFeatureIdx = layers.findIndex((l: any) => l.type === "feature");
                const insertIndex = firstFeatureIdx !== -1 ? firstFeatureIdx : layers.length;

                view.map?.add(layer, insertIndex);
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
        dayKey: string | null
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

        const itemsFromSelectedGroup = dayKey
            ? group.items.filter((item) => item.dayKey === dayKey)
            : group.latestItem
                ? [group.latestItem]
                : [];

        const latestOtherGroups = latestMapImageByGroup.filter(
            (item) => !group.items.some((gItem) => gItem.id === item.id)
        );

        const finalItems = [...latestOtherGroups, ...itemsFromSelectedGroup];

        removeAllDroneLayersFromViews(views);

        const uniqueUrls = new Set<string>();

        finalItems.forEach((item) => {
            addMapImageLayerToViews(views, item);
            uniqueUrls.add(item.url);
        });

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

    useEffect(() => {
        const views = getActiveViews();
        if (!views.length || !mapReady) return;

        applyDroneSelectionToViews(views, selectedDroneGroupKey, selectedDroneDay);
    }, [
        mapReady,
        dualMode,
        selectedDroneGroupKey,
        selectedDroneDay,
        latestMapImageByGroup,
        droneGroupsMap,
    ]);

    // (droneDatesSet removido: nearbyDroneDates é usado no lugar, populado pelo watcher de proximidade)

    // 🚁 Handler: clique em data drone no calendário aplica as layers correspondentes
    const handleDroneDateClick = (dayKey: string) => {
        const views = getActiveViews();
        if (!views.length) return;

        // Encontra o primeiro grupo que possui aquela data
        const matchingGroup = droneGroups.find((g) =>
            g.items.some((item) => item.dayKey === dayKey)
        );

        const groupKey = matchingGroup?.groupKey ?? null;
        setSelectedDroneGroupKey(groupKey);
        setSelectedDroneDay(dayKey);
        applyDroneSelectionToViews(views, groupKey, dayKey);
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
        ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${left.id}`
        : "";

    const rightUrl = right
        ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${right.id}`
        : "";

    const iconClass = showCamadas ? "fa-solid fa-xmark" : "fa-solid fa-layer-group";

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
                                onViewReady={async (view) => {
                                    swipeViewRef.current = view;
                                    leftViewRef.current = null;
                                    rightViewRef.current = null;

                                    reapplyActiveLayers([view]);
                                    await applyDroneSelectionToViews(
                                        [view],
                                        selectedDroneGroupKey,
                                        selectedDroneDay
                                    );

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
                                }}
                                onViewsReady={async ({ leftView, rightView }) => {
                                    swipeViewRef.current = null;
                                    leftViewRef.current = leftView;
                                    rightViewRef.current = rightView;

                                    reapplyActiveLayers([leftView, rightView]);
                                    await applyDroneSelectionToViews(
                                        [leftView, rightView],
                                        selectedDroneGroupKey,
                                        selectedDroneDay
                                    );

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

                            <h5 style={{ marginTop: 12 }}>Grupos Drone</h5>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                {droneGroups.map((group) => {
                                    const latest = group.latestItem;
                                    const count = group.items.length;

                                    return (
                                        <button
                                            key={group.groupKey}
                                            type="button"
                                            onClick={() => {
                                                setSelectedDroneGroupKey(group.groupKey);
                                                setSelectedDroneDay(latest?.dayKey ?? null);
                                            }}
                                            style={{
                                                textAlign: "left",
                                                fontWeight:
                                                    selectedDroneGroupKey === group.groupKey ? 700 : 400,
                                                padding: "6px 8px",
                                                borderRadius: 6,
                                                border: "1px solid #d1d5db",
                                                background:
                                                    selectedDroneGroupKey === group.groupKey
                                                        ? "#eef2ff"
                                                        : "#fff",
                                                cursor: "pointer",
                                            }}
                                        >
                                            {group.pointName || group.pointKey}
                                            {count > 1 ? ` [${count}]` : ""}
                                            {latest?.dayKey ? ` (${latest.dayKey})` : ""}
                                        </button>
                                    );
                                })}
                            </div>

                            {selectedDroneGroup && (
                                <>
                                    <h5 style={{ marginTop: 12 }}>Datas do grupo</h5>
                                    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                                        {selectedGroupAvailableDays.map((day) => (
                                            <button
                                                key={day}
                                                type="button"
                                                onClick={() => setSelectedDroneDay(day)}
                                                style={{
                                                    textAlign: "left",
                                                    fontWeight: selectedDroneDay === day ? 700 : 400,
                                                    padding: "6px 8px",
                                                    borderRadius: 6,
                                                    border: "1px solid #d1d5db",
                                                    background:
                                                        selectedDroneDay === day ? "#dcfce7" : "#fff",
                                                    cursor: "pointer",
                                                }}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </>
                            )}

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