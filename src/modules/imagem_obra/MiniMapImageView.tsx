// src/modules/imagem_obra/MiniMapImageView.tsx
import { useEffect, useMemo, useRef, useState } from "react";

import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";
import {
    ensureLayer0,
    fetchPointLayers,
    extractExposureGraphics,
    buildExposureMap,
    sortCandidatesDesc,
    safeNum,
} from "./imageObraUtils";
import "./MiniMapImageView.css";

type Props = {
    defaultZoom?: number;
};

export default function MiniMapImageView({ defaultZoom = 18 }: Props) {
    const divRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<__esri.MapView | null>(null);

    const [collapsed, setCollapsed] = useState(false);

    const lastClickedPoint = useAppStore((s) => s.lastClickedPoint);
    const setLastClickedPoint = useAppStore((s) => s.setLastClickedPoint);

    const setCandidateImages = useAppStore((s) => s.setCandidateImages);
    const setSelectedImageLeft = useAppStore((s) => s.setSelectedImageLeft);
    const setSelectedImageRight = useAppStore((s) => s.setSelectedImageRight);



    const layersRef = useRef<FeatureLayer[]>([]);
    const createdLayersRef = useRef<FeatureLayer[]>([]);

    const clickGraphicRef = useRef<__esri.Graphic | null>(null);

    const pointFetchOnce = useMemo(() => ({ done: false }), []);

    useEffect(() => {
        if (!divRef.current) return;
        if (viewRef.current) return;

        const map = new EsriMap({
            basemap: "streets-vector",
        });

        const view = new MapView({
            container: divRef.current,
            map,
            center: [-47.8825, -15.7942],
            zoom: defaultZoom,
            ui: { components: [] },
            constraints: { rotationEnabled: false },
        });

        viewRef.current = view;

        let cancelled = false;

        const loadPointLayers = async () => {
            if (pointFetchOnce.done) return;
            pointFetchOnce.done = true;

            try {
                const items = await fetchPointLayers();
                if (cancelled) return;

                const defs = (items || [])
                    .filter((it) => it?.serviceUrl)
                    .filter((it) => String(it.access || "").toLowerCase() === "public")
                    .map((it) => ({
                        id: it.id,
                        title: it.title ?? "Imagem da Obra",
                        url0: ensureLayer0(String(it.serviceUrl)),
                    }));

                for (const def of defs) {
                    const exists = layersRef.current.find((l) => l.id === `mini:io:${def.id}`);
                    if (exists) continue;

                    const layer = new FeatureLayer({
                        url: def.url0,
                        id: `mini:io:${def.id}`,
                        title: def.title,
                        outFields: ["*"],
                    });

                    map.add(layer);
                    layersRef.current.push(layer);
                    createdLayersRef.current.push(layer);

                    layer.load().catch((e) => {
                        console.warn(`[MiniMap] layer load falhou: ${def.title} (${def.url0})`, e);
                    });
                }
            } catch (e) {
                console.warn("[MiniMap] Falha ao carregar /point-layer:", e);
            }
        };

        view.when(() => {
            if (cancelled) return;

            loadPointLayers();

            if (lastClickedPoint) {
                placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
                safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
            }
        });

        const clickHandle = view.on("click", async (event) => {
            if (collapsed) return;

            const mp = view.toMap(event);
            if (mp) {
                setLastClickedPoint({
                    x: mp.x,
                    y: mp.y,
                    wkid: mp.spatialReference?.wkid ?? undefined,
                });
                placeClickMarker(mp.x, mp.y, mp.spatialReference?.wkid ?? undefined);
            }

            const includeLayers = layersRef.current;
            if (!includeLayers.length) return;

            const hit = await view.hitTest(event, { include: includeLayers });

            const exposureGraphics = extractExposureGraphics(hit.results, "mini:io:");

            if (exposureGraphics.length === 0) {
                setCandidateImages([]);
                setSelectedImageLeft(null);
                setSelectedImageRight(null);
                applyHighlight(null);
                return;
            }

            const uniq = buildExposureMap(exposureGraphics, (lyr) => ({
                __layerTitle: lyr.title ?? null,
                __layerId: lyr.id ?? null,
            }));
            const candidates = sortCandidatesDesc(Array.from(uniq.values()));

            setCandidateImages(candidates);

            const left = candidates[0] ?? null;
            const right = candidates[0] ?? null;

            setSelectedImageLeft(left);
            setSelectedImageRight(right);

            // if (!compareImageOpen) setCompareImageOpen(true);

            applyHighlight(left);

            const bestGraphic = exposureGraphics.find((gr) => {
                const lyr = gr.layer as FeatureLayer;
                const oidField = lyr.objectIdField;
                const oid = safeNum(gr.attributes?.[oidField]);
                return oid === left?.objectId && ensureLayer0(lyr.url) === left?.layerUrl;
            });

            try {
                if (bestGraphic?.geometry) {
                    await view.goTo(
                        { target: bestGraphic.geometry, zoom: Math.max(view.zoom ?? defaultZoom, defaultZoom) },
                        { duration: 250 }
                    );
                }
            } catch {
                // ignore
            }
        });

        return () => {
            cancelled = true;

            try {
                clickHandle?.remove();
            } catch { }

            const mapNow = viewRef.current?.map;
            if (mapNow) {
                for (const lyr of createdLayersRef.current) {
                    try {
                        mapNow.remove(lyr);
                        lyr.destroy?.();
                    } catch { }
                }
            }
            createdLayersRef.current = [];
            layersRef.current = [];

            try {
                view?.destroy();
            } catch { }

            viewRef.current = null;
            clickGraphicRef.current = null;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [divRef, defaultZoom]);

    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        if (!lastClickedPoint) return;

        placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
        safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastClickedPoint?.x, lastClickedPoint?.y, lastClickedPoint?.wkid, defaultZoom]);

    function applyHighlight(selected: ExposureRef | null) {
        const layers = layersRef.current;

        for (const lyr of layers) {
            try {
                (lyr as any).featureEffect = null;
            } catch { }
        }

        if (!selected) return;

        const targetLayer = layers.find((l) => ensureLayer0(l.url) === selected.layerUrl);
        if (!targetLayer) return;

        targetLayer.featureEffect = new FeatureEffect({
            filter: { where: `${targetLayer.objectIdField} = ${selected.objectId}` },
            includedEffect: "drop-shadow(2px, 2px, 3px, rgba(0,0,0,0.7)) brightness(1.25)",
            excludedEffect: "opacity(95%) grayscale(10%)",
        });
    }

    function placeClickMarker(x: number, y: number, wkid?: number) {
        const view = viewRef.current;
        if (!view) return;

        const pt = new Point({
            x,
            y,
            spatialReference: wkid ? { wkid } : view.spatialReference,
        });

        const symbol = new SimpleMarkerSymbol({
            style: "circle",
            size: 10,
            color: [255, 255, 255, 0.9] as any,
            outline: { color: [0, 0, 0, 0.8] as any, width: 1.5 },
        });

        const g = new Graphic({ geometry: pt, symbol });

        if (clickGraphicRef.current) {
            try {
                view.graphics.remove(clickGraphicRef.current);
            } catch { }
        }

        view.graphics.add(g);
        clickGraphicRef.current = g;
    }

    function safeGoTo(x: number, y: number, zoom: number, wkid?: number) {
        const view = viewRef.current;
        if (!view) return;

        const pt = new Point({
            x,
            y,
            spatialReference: wkid ? { wkid } : view.spatialReference,
        });

        view.when(() => {
            view.goTo({ target: pt, zoom }, { animate: true, duration: 250 }).catch(() => { });
        });
    }

    return (
        <div className={`minimap ${collapsed ? "is-collapsed" : ""}`}>
            <button
                type="button"
                className="minimap__toggleBtn"
                onClick={() => setCollapsed((v) => !v)}
                title={collapsed ? "Abrir mini mapa" : "Recolher mini mapa"}
            >
                {collapsed ? (
                    <i className="fa-regular fa-map minimap__icon minimap__icon--map" />
                ) : (
                    <i className="fa-solid fa-xmark minimap__icon minimap__icon--x" />
                )}
            </button>

            {!collapsed && <div className="minimap__hud">MiniMap • clique p/ trocar ponto</div>}

            <div ref={divRef} className="minimap__view" />
        </div>
    );
}
