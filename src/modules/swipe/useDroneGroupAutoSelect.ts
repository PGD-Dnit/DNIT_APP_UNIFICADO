/**
 * useDroneGroupAutoSelect.ts
 *
 * Hook que observa o evento `stationary` da MapView do ArcGIS.
 * Quando o mapa para, reprojeta os extents de cada DroneGroup para o SR
 * da view (Web Mercator 102100) e seleciona automaticamente o grupo com
 * maior sobreposição com a área visível.
 */

import { useCallback, useEffect, useRef } from "react";
import type MapView from "@arcgis/core/views/MapView";
import Extent from "@arcgis/core/geometry/Extent";
import SpatialReference from "@arcgis/core/geometry/SpatialReference";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import * as projection from "@arcgis/core/geometry/projection";
import {
    type DroneGroup,
    type ExtentBox,
    findBestDroneGroupForExtent,
} from "../../core/droneUtils";

interface Options {
    droneGroups: DroneGroup[];
    selectedGroupKey: string | null;
    onSelectGroup: (groupKey: string, latestDayKey: string | null) => void;
}

export function useDroneGroupAutoSelect({
    droneGroups,
    selectedGroupKey,
    onSelectGroup,
}: Options) {
    // Refs espelho — acessíveis dentro dos callbacks do ArcGIS sem re-registrar watches
    const droneGroupsRef = useRef<DroneGroup[]>(droneGroups);
    useEffect(() => { droneGroupsRef.current = droneGroups; }, [droneGroups]);

    const selectedGroupKeyRef = useRef<string | null>(selectedGroupKey);
    useEffect(() => { selectedGroupKeyRef.current = selectedGroupKey; }, [selectedGroupKey]);

    const onSelectGroupRef = useRef(onSelectGroup);
    useEffect(() => { onSelectGroupRef.current = onSelectGroup; }, [onSelectGroup]);

    // Pré-carrega o motor de reprojeção WASM ao montar o hook
    useEffect(() => {
        projection.load().catch(() => {
            console.warn("[useDroneGroupAutoSelect] Falha ao carregar módulo de projeção ArcGIS.");
        });
    }, []);

    /**
     * Registra o watcher `stationary` na view fornecida.
     * Deve ser chamado dentro do `onViewReady`.
     * Retorna uma função de cleanup que remove o watcher.
     */
    const setupAutoSelect = useCallback((view: MapView): (() => void) => {
        const handle = reactiveUtils.when(
            () => view.stationary === true,
            async () => {
                // Garante que o motor de reprojeção WASM está carregado antes de usar
                try {
                    await projection.load();
                } catch {
                    console.warn("[useDroneGroupAutoSelect] projection.load() falhou.");
                    return;
                }

                const ext = view.extent;
                const groups = droneGroupsRef.current;

                if (!ext || !groups.length) return;

                const viewWkid = ext.spatialReference?.wkid ?? 102100;
                const viewSR = new SpatialReference({ wkid: viewWkid });

                const viewBox: ExtentBox = {
                    xmin: ext.xmin,
                    ymin: ext.ymin,
                    xmax: ext.xmax,
                    ymax: ext.ymax,
                    wkid: viewWkid,
                };

                // Reprojeta extents para o SR da view
                const projectedGroups: DroneGroup[] = groups.map((group) => {
                    const re = group.representativeExtent;
                    if (!re) return group;

                    const groupWkid = re.wkid;
                    const groupWkt = re.wkt;

                    // Mesmo wkid numérico → usa direto, sem reprojeção
                    if (groupWkid != null && groupWkid === viewWkid) return group;

                    // Determina o SR do grupo: prefere wkid, cai em wkt (caso SIRGAS UTM sem wkid)
                    let groupSR: SpatialReference | null = null;
                    if (groupWkid != null) {
                        groupSR = new SpatialReference({ wkid: groupWkid });
                    } else if (groupWkt) {
                        groupSR = new SpatialReference({ wkt: groupWkt });
                    }

                    // Se não há informação de SR, não há como reprojetar → ignora
                    if (!groupSR) {
                        console.warn(`[useDroneGroupAutoSelect] Grupo "${group.groupKey}" sem wkid e sem wkt — pulado na reprojeção.`);
                        return group;
                    }

                    try {
                        const arcExtent = new Extent({
                            xmin: re.xmin,
                            ymin: re.ymin,
                            xmax: re.xmax,
                            ymax: re.ymax,
                            spatialReference: groupSR,
                        });

                        const projected = projection.project(arcExtent, viewSR) as Extent | null;
                        if (!projected) return group;

                        return {
                            ...group,
                            representativeExtent: {
                                xmin: projected.xmin,
                                ymin: projected.ymin,
                                xmax: projected.xmax,
                                ymax: projected.ymax,
                                wkid: viewWkid,
                            },
                        };
                    } catch (err) {
                        console.warn(`[useDroneGroupAutoSelect] Reprojeção falhou para grupo "${group.groupKey}":`, err);
                        return group;
                    }
                });

                const best = findBestDroneGroupForExtent(viewBox, projectedGroups);

                console.debug(
                    `[useDroneGroupAutoSelect] stationary → melhor grupo: "${best?.groupKey ?? "nenhum"}"`,
                    `(atual: "${selectedGroupKeyRef.current ?? "nenhum"}")`
                );

                // Só atualiza se o grupo mudou para evitar re-renders desnecessários
                if (best && best.groupKey !== selectedGroupKeyRef.current) {
                    onSelectGroupRef.current(best.groupKey, best.latestItem?.dayKey ?? null);
                }
            }
        );

        return () => {
            try { handle.remove(); } catch { /* view pode já estar destruída */ }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    return { setupAutoSelect };
}
