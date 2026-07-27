import { useState, useEffect } from "react";
import { CONFIG } from "../../core/config";
import {
    type MapImageItem,
    parseDroneServiceName,
    parseExtent,
    getExtentCenter,
    getExtentArea,
} from "../../core/droneUtils";

export type LayerItem = {
    id: string;
    title: string;
    url: string;
};

export function useMapLayersData() {
    const [featureServices, setFeatureServices] = useState<LayerItem[]>([]);
    const [loadingFeatures, setLoadingFeatures] = useState(true);
    const [erro, setErro] = useState<string | null>(null);

    const [mapImageLayers, setMapImageLayers] = useState<MapImageItem[]>([]);
    const [mapImageLayersLoading, setMapImageLayersLoading] = useState(true);
    const [mapImageLayersError, setMapImageLayersError] = useState<string | null>(null);

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

    return {
        featureServices,
        loadingFeatures,
        erro,
        mapImageLayers,
        mapImageLayersLoading,
        mapImageLayersError,
    };
}
