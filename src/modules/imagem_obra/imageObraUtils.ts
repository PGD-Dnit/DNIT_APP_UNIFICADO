// src/modules/imagem_obra/imageObraUtils.ts
//
// Utilitários compartilhados entre SetupImageOnView.tsx e MiniMapImageView.tsx.
// Não importar ArcGIS ou React aqui — este arquivo deve ter zero side-effects.

import type FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import type { ExposureRef } from "../../core/types";
import { CONFIG } from "../../core/config";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

export type PointLayerItem = {
    id: string;             // portal item id
    title?: string;
    access?: string;        // "public"
    serviceUrl?: string | null; // pode vir .../FeatureServer ou .../FeatureServer/0
};

// ---------------------------------------------------------------------------
// Funções utilitárias numéricas / de data
// ---------------------------------------------------------------------------

/** Converte qualquer valor para number, retornando null se não for finito. */
export function safeNum(v: any): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

/**
 * Converte um valor de data (number, string ISO, Date) para epoch-ms.
 * Números menores que 1e12 são tratados como epoch-segundos e convertidos.
 */
export function toEpochMs(v: any): number | null {
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

/**
 * Garante que a URL da camada termine em /0 (sublayer 0 do FeatureServer).
 * Necessário para que os endpoints de attachments funcionem corretamente.
 */
export function ensureLayer0(url: string | null | undefined): string {
    const u = (url || "").replace(/\/+$/, "");
    if (u.endsWith("/0")) return u;
    if (u.endsWith("/FeatureServer")) return `${u}/0`;
    // se vier .../FeatureServer/1 etc, mantém
    if (/\/FeatureServer\/\d+$/.test(u)) return u;
    return u;
}

// ---------------------------------------------------------------------------
// Chamada HTTP
// ---------------------------------------------------------------------------

/** Busca a lista de camadas de ponto do endpoint /point-layer. */
export async function fetchPointLayers(): Promise<PointLayerItem[]> {
    const r = await fetch(`${CONFIG.API_BASE}/point-layer`, { credentials: "include" });
    const raw = await r.text();

    if (!r.ok) {
        throw new Error(`GET /point-layer falhou: HTTP ${r.status} — ${raw.slice(0, 200)}`);
    }

    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Resposta não-JSON em /point-layer: ${raw.slice(0, 120)}`);
    }

    return Array.isArray(data) ? (data as PointLayerItem[]) : [];
}

// ---------------------------------------------------------------------------
// Lógica de hitTest / construção de ExposureRef
// ---------------------------------------------------------------------------

/**
 * Extrai os graphics válidos de um resultado de hitTest, filtrando pelo
 * prefixo de ID da camada fornecido (ex: "io:" ou "mini:io:").
 */
export function extractExposureGraphics(
    results: __esri.HitTestResult["results"],
    layerIdPrefix: string
): __esri.Graphic[] {
    return results
        .map((r) => (r as __esri.MapViewGraphicHit).graphic)
        .filter((g) => {
            const lyr: any = g?.layer;
            return (
                lyr &&
                lyr.type === "feature" &&
                String(lyr.id || "").startsWith(layerIdPrefix) &&
                g.attributes
            );
        }) as __esri.Graphic[];
}

/**
 * Constrói um Map dedupado de ExposureRef a partir de uma lista de graphics,
 * usando `"<layerUrl0>::<objectId>"` como chave de deduplicação.
 *
 * @param graphics     Graphics filtrados pelo hitTest
 * @param extraAttrs   Atributos extras a mesclar em cada ExposureRef.attrs
 *                     (ex: { __layerTitle, __layerId } do MiniMap)
 */
export function buildExposureMap(
    graphics: __esri.Graphic[],
    extraAttrs?: (lyr: FeatureLayer) => Record<string, any>
): globalThis.Map<string, ExposureRef> {
    const uniq = new globalThis.Map<string, ExposureRef>();

    for (const g of graphics) {
        const lyr = g.layer as FeatureLayer;
        const oidField = lyr.objectIdField;
        const objectId = safeNum(g.attributes?.[oidField]);
        if (objectId == null) continue;

        const acqRaw =
            g.attributes?.acquisitiondate ??
            g.attributes?.acquisitionDate ??
            g.attributes?.AcquisitionDate ??
            g.attributes?.data ??
            null;

        const acqMs = toEpochMs(acqRaw);
        const layerUrl0 = ensureLayer0(lyr.url);

        const ref: ExposureRef = {
            objectId,
            layerUrl: layerUrl0,
            title: g.attributes?.name ?? lyr.title ?? "Imagem da Obra",
            attrs: {
                ...g.attributes,
                acquisitiondate: acqMs ?? null,
                ...(extraAttrs ? extraAttrs(lyr) : {}),
            },
            acquisitionDate: acqMs ?? undefined,
        };

        uniq.set(`${layerUrl0}::${objectId}`, ref);
    }

    return uniq;
}

/**
 * Ordena candidates por acquisitiondate decrescente (mais recente primeiro).
 */
export function sortCandidatesDesc(candidates: ExposureRef[]): ExposureRef[] {
    return candidates.sort((a, b) => {
        const da = safeNum(a.attrs?.acquisitiondate) ?? 0;
        const db = safeNum(b.attrs?.acquisitiondate) ?? 0;
        return db - da;
    });
}

/**
 * Faz queryFeatures espacial em todas as layers fornecidas usando um ponto.
 * Retorna TODOS os features que intersectam o ponto — sem a limitação do hitTest
 * que só retorna features renderizados na viewport.
 *
 * @param layers       Camadas a consultar
 * @param point        Ponto Esri (MapPoint do clique)
 * @param extraAttrs   Atributos extras por layer (ex: { __layerTitle, __layerId })
 */
export async function queryExposuresAtPoint(
    layers: FeatureLayer[],
    point: __esri.Point,
    extraAttrs?: (lyr: FeatureLayer) => Record<string, any>
): Promise<globalThis.Map<string, ExposureRef>> {
    const uniq = new globalThis.Map<string, ExposureRef>();

    await Promise.all(
        layers.map(async (layer) => {
            try {
                const query = layer.createQuery();
                query.geometry = point;
                query.spatialRelationship = "intersects";
                query.outFields = ["*"];
                query.returnGeometry = false;

                const result = await layer.queryFeatures(query);

                for (const feature of result.features) {
                    const oidField = layer.objectIdField;
                    const objectId = safeNum(feature.attributes?.[oidField]);
                    if (objectId == null) continue;

                    const acqRaw =
                        feature.attributes?.acquisitiondate ??
                        feature.attributes?.acquisitionDate ??
                        feature.attributes?.AcquisitionDate ??
                        feature.attributes?.data ??
                        null;

                    const acqMs = toEpochMs(acqRaw);
                    const layerUrl0 = ensureLayer0(layer.url);

                    const ref: ExposureRef = {
                        objectId,
                        layerUrl: layerUrl0,
                        title: feature.attributes?.name ?? layer.title ?? "Imagem da Obra",
                        attrs: {
                            ...feature.attributes,
                            acquisitiondate: acqMs ?? null,
                            ...(extraAttrs ? extraAttrs(layer) : {}),
                        },
                        acquisitionDate: acqMs ?? undefined,
                    };

                    uniq.set(`${layerUrl0}::${objectId}`, ref);
                }
            } catch (e) {
                console.warn("[queryExposuresAtPoint] falhou para layer:", layer.title, e);
            }
        })
    );

    return uniq;
}
