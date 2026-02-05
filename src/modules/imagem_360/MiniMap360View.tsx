// src/modules/imagem_360/MiniMap360View.tsx
import React, { useEffect, useMemo, useRef, useState } from "react";

import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import Point from "@arcgis/core/geometry/Point";
import Graphic from "@arcgis/core/Graphic";
import SimpleMarkerSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";

import { FaXmark, } from "react-icons/fa6";

import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";
import { CONFIG } from "../../core/config";

type Props = {
    defaultZoom?: number;
};

function safeNum(v: any): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
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

    // ⚠️ Se você quiser o mesmo comportamento do Map360View (abrir compareOpen ao clicar no mini),
    // descomente estas 2 linhas:
    const setCompareOpen = useAppStore((s) => s.setCompareOpen);
    const compareOpen = useAppStore((s) => s.compareOpen);

    // camada e efeito ficam “presos” ao ciclo do MapView
    const exposureLayerRef = useRef<__esri.FeatureLayer | null>(null);

    // marcador do último clique (só visual)
    const clickGraphicRef = useRef<__esri.Graphic | null>(null);

    const layerUrl = useMemo(() => CONFIG.IMAGENS360_LAYER_URL, []);

    // =========================
    // 1) Cria o mini MapView
    // =========================
    useEffect(() => {
        if (!divRef.current) return;
        if (viewRef.current) return; // não recriar

        const map = new EsriMap({
            basemap: "streets-vector", // ✅ street (sem API key em muitos ambientes; se falhar, troque p/ "streets")
        });

        const exposureLayer = new FeatureLayer({
            url: layerUrl, // já com /0
            outFields: ["*"],
            title: "Exposure Points (mini)",
        });

        exposureLayerRef.current = exposureLayer;
        map.add(exposureLayer);

        const view = new MapView({
            container: divRef.current,
            map,
            center: [-47.8825, -15.7942], // inicial, depois vai sincronizar com lastClickedPoint
            zoom: defaultZoom,
            ui: { components: [] },
            constraints: { rotationEnabled: false },
        });

        viewRef.current = view;

        // ✅ quando o view estiver pronto, adiciona o marcador (se já tiver lastClickedPoint)
        view.when(() => {
            if (lastClickedPoint) {
                placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
                safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
            }
        });

        // CLICK no mini mapa (seleciona outro ponto)
        const clickHandle = view.on("click", async (event) => {
            // ⚠️ quando recolhido, ignora (não rouba evento do pano)
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

            const exposureLayerLocal = exposureLayerRef.current;
            if (!exposureLayerLocal) return;

            const hit = await view.hitTest(event, { include: [exposureLayerLocal] });


            // ✅ só hits da exposureLayer
            const exposureGraphics = hit.results
                .map((r) => (r as __esri.MapViewGraphicHit).graphic)
                .filter((g) => g?.layer === exposureLayerLocal && g.attributes) as __esri.Graphic[];

            if (exposureGraphics.length === 0) {
                // limpa seleção, mas mantém marcador e lastClickedPoint
                setCandidateExposures([]);
                setSelectedExposureLeft(null);
                setSelectedExposureRight(null);
                applyHighlight(null);
                return;
            }

            // monta candidates (sobrepostos)
            const rawCandidates: ExposureRef[] = exposureGraphics
                .map((g) => {
                    const oid = g.attributes?.OBJECTID ?? g.attributes?.objectid ?? g.attributes?.ObjectId;
                    const objectId = safeNum(oid);
                    if (objectId == null) return null;

                    const acq = g.attributes?.acquisitiondate ?? g.attributes?.acquisitionDate ?? null;
                    const acquisitionDate = safeNum(acq);

                    const ref: ExposureRef = {
                        objectId,
                        layerUrl,
                        title: "Exposure",
                        attrs: {
                            ...g.attributes,
                            acquisitiondate: acquisitionDate ?? g.attributes?.acquisitiondate ?? null,
                        },
                        acquisitionDate: acquisitionDate ?? undefined,
                    };

                    return ref;
                })
                .filter(Boolean) as ExposureRef[];

            // remove duplicados por objectId
            const uniq = new globalThis.Map<number, ExposureRef>();
            for (const c of rawCandidates) uniq.set(c.objectId, c);
            const candidates = Array.from(uniq.values());

            // ordena por data desc
            candidates.sort((a, b) => {
                const da = safeNum(a.attrs?.acquisitiondate) ?? 0;
                const db = safeNum(b.attrs?.acquisitiondate) ?? 0;
                return db - da;
            });

            setCandidateExposures(candidates);

            const left = candidates[0] ?? null;
            //const right = candidates[1] ?? candidates[0] ?? null;
            const right = candidates[0] ?? null;

            setSelectedExposureLeft(left);
            setSelectedExposureRight(right);

            // ✅ abre a tela de comparação se ainda não estiver aberta
            if (!compareOpen) setCompareOpen(true);

            applyHighlight(left?.objectId ?? null);

            // zoom no primeiro
            const bestGraphic = exposureGraphics.find((g) => {
                const oid = g.attributes?.OBJECTID ?? g.attributes?.objectid ?? g.attributes?.ObjectId;
                return safeNum(oid) === left?.objectId;
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
            try {
                clickHandle?.remove();
            } catch { }
            try {
                view?.destroy();
            } catch { }
            viewRef.current = null;
            exposureLayerRef.current = null;
            clickGraphicRef.current = null;
        };

        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [divRef, layerUrl]);

    // =========================
    // 2) Sempre que lastClickedPoint mudar, recentraliza o mini mapa
    // =========================
    useEffect(() => {
        const view = viewRef.current;
        if (!view) return;
        if (!lastClickedPoint) return;

        // atualiza marcador e dá goTo
        placeClickMarker(lastClickedPoint.x, lastClickedPoint.y, lastClickedPoint.wkid);
        safeGoTo(lastClickedPoint.x, lastClickedPoint.y, defaultZoom, lastClickedPoint.wkid);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [lastClickedPoint?.x, lastClickedPoint?.y, lastClickedPoint?.wkid, defaultZoom]);

    // =========================
    // Helpers: highlight + marker + goTo
    // =========================
    function applyHighlight(oid: number | null) {
        const exposureLayer = exposureLayerRef.current;
        if (!exposureLayer) return;

        if (!oid) {
            exposureLayer.featureEffect = null;
            return;
        }

        exposureLayer.featureEffect = new FeatureEffect({
            filter: { where: `OBJECTID = ${oid}` },
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

        // remove antigo
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

        // ⚠️ Se o view ainda não estiver “ready”, goTo pode abortar
        view.when(() => {
            view.goTo({ target: pt, zoom }, { animate: true, duration: 250 }).catch(() => { });
        });
    }

    // =========================
    // UI (container + botão retrátil)
    // =========================
    return (
        <div
            style={{
                width: collapsed ? 44 : 480,
                height: collapsed ? 44 : 220,
                borderRadius: 10,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.18)",
                background: "rgba(0,0,0,0.35)",
                backdropFilter: "blur(6px)",
                position: "relative",
                pointerEvents: "auto",
            }}
        >
            {/* Botão retrátil */}
            <button
                type="button"
                onClick={() => setCollapsed((v) => !v)}
                title={collapsed ? "Abrir mini mapa" : "Recolher mini mapa"}
                style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    zIndex: 10,
                    width: 30,
                    height: 30,
                    borderRadius: 10,
                    border: "1px solid rgba(255,255,255,0.18)",
                    background: "rgba(0,0,0,0.45)",
                    color: "inherit",
                    cursor: "pointer",
                    display: "flex!important",
                    alignItems: "center !important",
                    justifyContent: "center !important",
                    placeItems: "left",
                }}
            >
                {collapsed ? (
                    <i
                        className="fa-regular fa-map"
                        style={{
                            lineHeight: 1,
                            textAlign: "center",
                            width: "100%",
                            marginLeft: "-5px",
                        }}
                    />
                ) : (
                    <i
                        className="fa-solid fa-xmark"
                        style={{
                            lineHeight: 1,
                            textAlign: "center",
                            width: "100%",
                            marginLeft: "-3px",
                        }}
                    />
                )}

            </button>

            {/* “HUD” compacto */}
            {
                !collapsed && (
                    <div
                        style={{
                            position: "absolute",
                            left: 8,
                            top: 8,
                            zIndex: 10,
                            fontSize: 11,
                            padding: "4px 6px",
                            borderRadius: 8,
                            background: "rgba(0,0,0,0.45)",
                            border: "1px solid rgba(255,255,255,0.12)",
                        }}
                    >
                        MiniMap • clique p/ trocar ponto
                    </div>
                )
            }

            {/* View */}
            <div
                ref={divRef}
                style={{
                    width: "100%",
                    height: "100%",
                    opacity: collapsed ? 0 : 1,
                    pointerEvents: collapsed ? "none" : "auto",
                }}
            />
        </div >
    );
}
