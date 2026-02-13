// src/modules/imagem_360/MiniMap360View.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";
import { CONFIG } from "../../core/config";
import "./MiniMap360View.css";

type Props = {
    defaultZoom?: number;
};

type OrientedItem = {
    id: string; // portal item id
    title?: string;
    access?: string; // "public"
    serviceUrl?: string | null; // pode vir .../FeatureServer ou .../FeatureServer/0
};

function safeNum(v: any): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function toEpochMs(v: any): number | null {
    if (v == null) return null;

    if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;

    if (typeof v === "string") {
        const n = Number(v);
        if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;

        const t = Date.parse(v);
        return Number.isFinite(t) ? t : null;
    }

    if (v instanceof Date) return v.getTime();
    return null;
}

function ensureLayer0(url: string) {
    const u = (url || "").replace(/\/+$/, "");
    if (u.endsWith("/0")) return u;
    if (u.endsWith("/FeatureServer")) return `${u}/0`;
    if (/\/FeatureServer\/\d+$/.test(u)) return u;
    return u;
}

async function fetchOrientedImagery(): Promise<OrientedItem[]> {
    const r = await fetch(`${CONFIG.API_BASE}/oriented-imagery`, {
        credentials: "include",
    });

    const raw = await r.text();
    if (!r.ok) {
        throw new Error(`GET /oriented-imagery falhou: HTTP ${r.status} — ${raw.slice(0, 200)}`);
    }

    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Resposta não-JSON em /oriented-imagery: ${raw.slice(0, 120)}`);
    }

    return Array.isArray(data) ? (data as OrientedItem[]) : [];
}

export default function MiniMap360View({ defaultZoom = 18 }: Props) {
    const divRef = useRef<HTMLDivElement | null>(null);
    const viewRef = useRef<__esri.MapView | null>(null);

    const [collapsed, setCollapsed] = useState(false);

    const lastClickedPoint = useAppStore((s) => s.lastClickedPoint);
    const setLastClickedPoint = useAppStore((s) => s.setLastClickedPoint);

    const setCandidateExposures = useAppStore((s) => s.setCandidateExposures);
    const setSelectedExposureLeft = useAppStore((s) => s.setSelectedExposureLeft);
    const setSelectedExposureRight = useAppStore((s) => s.setSelectedExposureRight);

    const setCompareOpen = useAppStore((s) => s.setCompareOpen);
    const compareOpen = useAppStore((s) => s.compareOpen);

    // ✅ múltiplas camadas oriented no mini
    const layersRef = useRef<FeatureLayer[]>([]);
    const createdLayersRef = useRef<FeatureLayer[]>([]);

    // marcador do último clique (só visual)
    const clickGraphicRef = useRef<__esri.Graphic | null>(null);

    // apenas pra forçar 1 fetch por mount
    const orientedFetchOnce = useMemo(() => ({ done: false }), []);

    // =========================
    // 1) Cria o mini MapView + carrega camadas /oriented-imagery
    // =========================
    useEffect(() => {
        if (!divRef.current) return;
        if (viewRef.current) return; // não recriar

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

        // ✅ carrega TODAS as camadas oriented imagery no mini
        const loadOrientedLayers = async () => {
            if (orientedFetchOnce.done) return;
            orientedFetchOnce.done = true;

            try {
                const items = await fetchOrientedImagery();
                if (cancelled) return;

                const defs = (items || [])
                    .filter((it) => it?.serviceUrl)
                    // se quiser confiar só no backend, pode remover este filter
                    .filter((it) => String(it.access || "").toLowerCase() === "public")
                    .map((it) => ({
                        id: it.id,
                        title: it.title ?? "Imagem 360",
                        url0: ensureLayer0(String(it.serviceUrl)),
                    }));

                for (const def of defs) {
                    // evita duplicar se houver reload
                    const exists = layersRef.current.find((l) => l.id === `mini:oi:${def.id}`);
                    if (exists) continue;

                    const layer = new FeatureLayer({
                        url: def.url0,
                        id: `mini:oi:${def.id}`,
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
                console.warn("[MiniMap] Falha ao carregar /oriented-imagery:", e);
            }
        };

        // quando view estiver pronto, aplica marcador/zoom se já tiver lastClickedPoint
        view.when(() => {
            if (cancelled) return;

            loadOrientedLayers();

            if (lastClickedPoint) {
                placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
                safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
            }
        });

        // CLICK no mini mapa (seleciona outro ponto)
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

            // ✅ só hits das layers oriented do mini
            const exposureGraphics = hit.results
                .map((r) => (r as __esri.MapViewGraphicHit).graphic)
                .filter((g) => {
                    const lyr: any = g?.layer;
                    return (
                        lyr &&
                        lyr.type === "feature" &&
                        String(lyr.id || "").startsWith("mini:oi:") &&
                        g.attributes
                    );
                }) as __esri.Graphic[];

            if (exposureGraphics.length === 0) {
                setCandidateExposures([]);
                setSelectedExposureLeft(null);
                setSelectedExposureRight(null);
                applyHighlight(null);
                return;
            }

            // ✅ monta candidates (sobrepostos) — múltiplas layers
            const uniq = new globalThis.Map<string, ExposureRef>();

            for (const g of exposureGraphics) {
                const lyr = g.layer as FeatureLayer;

                const oidField = lyr.objectIdField;
                const objectId = safeNum(g.attributes?.[oidField]);
                if (objectId == null) continue;

                const acqRaw =
                    g.attributes?.acquisitiondate ??
                    g.attributes?.acquisitionDate ??
                    g.attributes?.AcquisitionDate ??
                    null;

                const acqMs = toEpochMs(acqRaw);

                const layerUrl0 = ensureLayer0(lyr.url);

                const ref: ExposureRef = {
                    objectId,
                    layerUrl: layerUrl0,
                    title: g.attributes?.name ?? lyr.title ?? "Imagem 360",
                    attrs: {
                        ...g.attributes,
                        acquisitiondate: acqMs ?? null,
                        __layerTitle: lyr.title ?? null,
                        __layerId: lyr.id ?? null,
                    },
                    acquisitionDate: acqMs ?? undefined,
                };

                uniq.set(`${layerUrl0}::${objectId}`, ref);
            }

            const candidates = Array.from(uniq.values());

            // ordena por data desc
            candidates.sort((a, b) => {
                const da = safeNum(a.attrs?.acquisitiondate) ?? 0;
                const db = safeNum(b.attrs?.acquisitiondate) ?? 0;
                return db - da;
            });

            setCandidateExposures(candidates);

            const left = candidates[0] ?? null;
            const right = candidates[0] ?? null;

            setSelectedExposureLeft(left);
            setSelectedExposureRight(right);

            // abre a tela de comparação se ainda não estiver aberta
            if (!compareOpen) setCompareOpen(true);

            // highlight do selecionado (aplica por layer, usando FeatureEffect na layer certa)
            applyHighlight(left);

            // zoom no primeiro (se achar geometry)
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

        // cleanup
        return () => {
            cancelled = true;

            try {
                clickHandle?.remove();
            } catch { }

            // remove layers criadas
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

    // =========================
    // 2) Sempre que lastClickedPoint mudar, recentraliza o mini mapa
    // =========================
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        if (!lastClickedPoint) return;

        placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
        safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastClickedPoint?.x, lastClickedPoint?.y, lastClickedPoint?.wkid, defaultZoom]);

    // =========================
    // Helpers: highlight + marker + goTo
    // =========================

    /** aplica destaque só na layer do candidato */
    function applyHighlight(selected: ExposureRef | null) {
        const layers = layersRef.current;

        // limpa
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

    // =========================
    // UI
    // =========================
    return (
        <div className={`minimap ${collapsed ? "is-collapsed" : ""}`}>
            {/* Botão retrátil */}
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
