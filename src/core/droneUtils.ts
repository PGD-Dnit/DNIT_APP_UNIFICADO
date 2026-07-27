/**
 * droneUtils.ts
 * Funções utilitárias puras para agrupamento e parsing de camadas drone (MapImage).
 * Compartilhado entre SwipePage e SingleMapPage.
 */

// ─────────────────────────────────────────────────────────────
// Tipos
// ─────────────────────────────────────────────────────────────

export type ExtentBox = {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
    wkid?: number;
    /** WKT da spatialReference — presente quando o serviço não fornece wkid numérico (ex: UTM SIRGAS WKT) */
    wkt?: string | null;
};

export type CenterPoint = {
    x: number;
    y: number;
    wkid?: number;
};

export type MapImageItem = {
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

export type DroneGroup = {
    groupKey: string;
    pointKey: string;
    pointName: string;
    items: MapImageItem[];
    latestItem: MapImageItem | null;
    representativeCenter: CenterPoint | null;
    representativeExtent: ExtentBox | null;
};

// ─────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────

const STRONG_OVERLAP_THRESHOLD = 0.6;
const OVERLAP_THRESHOLD = 0.3;
const CENTER_DISTANCE_METERS = 500;
const NAME_DISTANCE_METERS = 200;

// ─────────────────────────────────────────────────────────────
// Utilitários numéricos
// ─────────────────────────────────────────────────────────────

export const safeNum = (v: any): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};

export const formatCoord = (value: number | null | undefined): string => {
    if (value == null || !Number.isFinite(value)) return "—";
    return value.toFixed(2);
};

// ─────────────────────────────────────────────────────────────
// Normalização de nomes
// ─────────────────────────────────────────────────────────────

export const normalizePointKey = (value: string): string =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\.(tif|tiff)$/gi, "")
        .replace(/_tif$/gi, "")
        .replace(/-tif$/gi, "")
        .replace(/[_\s]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
        .toLowerCase();

// ─────────────────────────────────────────────────────────────
// Parsing de datas
// ─────────────────────────────────────────────────────────────

export const parseDatePartsToDayKey = (
    yearRaw: string,
    monthRaw: string,
    dayRaw: string
): { dayKey: string | null; sourceDateMs: number | null } => {
    const yearNum = Number(yearRaw.length === 2 ? `20${yearRaw}` : yearRaw);
    const monthNum = Number(monthRaw);
    const dayNum = Number(dayRaw);

    const d = new Date(yearNum, monthNum - 1, dayNum);
    const valid =
        d.getFullYear() === yearNum &&
        d.getMonth() === monthNum - 1 &&
        d.getDate() === dayNum;

    if (!valid) return { dayKey: null, sourceDateMs: null };

    return {
        dayKey: `${yearNum}-${String(monthNum).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`,
        sourceDateMs: d.getTime(),
    };
};

/**
 * Exemplos aceitos:
 *   Ponte_Autaz_Mirim_03_03_26_tif
 *   Ponte_autaz_mirim_20_02_2026_tif
 *   drone_formosa_02_09_2025
 *   Drone_Formosa_13_07_2026_50cm   ← sufixo de resolução é removido antes do parse
 */
export const parseDroneServiceName = (serviceName: string) => {
    const cleaned = serviceName
        .trim()
        .replace(/\/+$/, "")
        .replace(/\.(tif|tiff)$/i, "")
        .replace(/_tif$/i, "")
        .replace(/-tif$/i, "")
        // Remove sufixos de resolução como _50cm, _30cm, _1m, _10m, etc.
        .replace(/_\d+(?:cm|m)$/i, "");

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

// ─────────────────────────────────────────────────────────────
// Extents e geometria
// ─────────────────────────────────────────────────────────────

export const parseExtent = (raw: any): ExtentBox | null => {
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

    // Extrai WKT como fallback para SRs que não fornecem wkid numérico (ex: SIRGAS UTM via WKT)
    // Prefere wkt (WKT1) sobre wkt2 (WKT2) pela compatibilidade mais ampla com o ArcGIS
    const sr = raw?.spatialReference;
    const wkt: string | null =
        (typeof sr?.wkt === "string" && sr.wkt ? sr.wkt :
         typeof sr?.wkt2 === "string" && sr.wkt2 ? sr.wkt2 :
         null);

    return { xmin, ymin, xmax, ymax, wkid, wkt };
};

export const getExtentCenter = (extent: ExtentBox | null | undefined): CenterPoint | null => {
    if (!extent) return null;
    return {
        x: (extent.xmin + extent.xmax) / 2,
        y: (extent.ymin + extent.ymax) / 2,
        wkid: extent.wkid,
    };
};

export const getExtentArea = (extent: ExtentBox | null | undefined): number | null => {
    if (!extent) return null;
    const width = extent.xmax - extent.xmin;
    const height = extent.ymax - extent.ymin;
    if (width <= 0 || height <= 0) return null;
    return width * height;
};

export const distanceMeters = (
    a: CenterPoint | null | undefined,
    b: CenterPoint | null | undefined
): number | null => {
    if (!a || !b) return null;
    if (a.wkid != null && b.wkid != null && a.wkid !== b.wkid) return null;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.sqrt(dx * dx + dy * dy);
};

export const getIntersectionArea = (
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

export const getIntersectionPctOnSmaller = (
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

// ─────────────────────────────────────────────────────────────
// Agrupamento de imagens drone
// ─────────────────────────────────────────────────────────────

export const averageCenters = (items: MapImageItem[]): CenterPoint | null => {
    const centers = items.map((i) => i.center).filter((c): c is CenterPoint => !!c);
    if (!centers.length) return null;
    const sum = centers.reduce(
        (acc, c) => { acc.x += c.x; acc.y += c.y; return acc; },
        { x: 0, y: 0 }
    );
    return { x: sum.x / centers.length, y: sum.y / centers.length, wkid: centers[0].wkid };
};

export const namesLookEquivalent = (a?: string | null, b?: string | null): boolean => {
    if (!a || !b) return false;
    return normalizePointKey(a) === normalizePointKey(b);
};

export const buildSimilarity = (a: MapImageItem, b: MapImageItem) => {
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
        centerDist != null && centerDist <= NAME_DISTANCE_METERS && sameLogicalName;
    const sameNameOnly =
        sameLogicalName && centerDist === null && namesLookEquivalent(a.pointKey, b.pointKey);

    const isSameGroup = strongOverlap || overlapAndNear || nearAndSameName || sameNameOnly;

    return {
        overlapPct,
        centerDist,
        sameLogicalName,
        strongOverlap,
        overlapAndNear,
        nearAndSameName,
        sameNameOnly,
        isSameGroup,
    };
};

export const itemsAreSameSpatialGroup = (
    candidate: MapImageItem,
    groupItems: MapImageItem[]
): boolean => {
    if (!groupItems.length) return false;
    return groupItems.some((existing) => buildSimilarity(candidate, existing).isSameGroup);
};

export const inferGroupLabel = (items: MapImageItem[]): string => {
    const names = items
        .map((i) => i.pointName || i.pointKey || i.rawServiceName || i.serviceName)
        .filter((v): v is string => !!v);

    if (!names.length) return "grupo-drone";

    const normalized = names.map((n) => normalizePointKey(n));
    const counts = new Map<string, number>();
    normalized.forEach((n) => { counts.set(n, (counts.get(n) || 0) + 1); });

    const winner = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    return winner || "grupo-drone";
};

export const groupDroneImages = (items: MapImageItem[]): DroneGroup[] => {
    const sorted = [...items].sort((a, b) => (b.sourceDateMs ?? 0) - (a.sourceDateMs ?? 0));
    const spatialBuckets: MapImageItem[][] = [];

    sorted.forEach((item) => {
        let matchedBucket: MapImageItem[] | null = null;
        for (const bucket of spatialBuckets) {
            if (itemsAreSameSpatialGroup(item, bucket)) { matchedBucket = bucket; break; }
        }
        if (matchedBucket) matchedBucket.push(item);
        else spatialBuckets.push([item]);
    });

    const groups: DroneGroup[] = spatialBuckets.map((bucket, index) => {
        const bucketSorted = [...bucket].sort((a, b) => (b.sourceDateMs ?? 0) - (a.sourceDateMs ?? 0));
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

    return groups.sort((a, b) => (b.latestItem?.sourceDateMs ?? 0) - (a.latestItem?.sourceDateMs ?? 0));
};

// ─────────────────────────────────────────────────────────────
// Auto-seleção de grupo pela posição do mapa
// ─────────────────────────────────────────────────────────────

/**
 * Dado o extent atual da MapView (todos os grupos já reprojetados para o mesmo
 * SR da view pelo hook useDroneGroupAutoSelect), retorna o DroneGroup com maior
 * sobreposição percentual com a área visível.
 *
 * Fallback: se nenhum grupo intersecta a view, retorna o de centro mais próximo.
 * Retorna null se a lista estiver vazia ou nenhum extent for válido.
 */
export const findBestDroneGroupForExtent = (
    viewExtent: ExtentBox,
    groups: DroneGroup[]
): DroneGroup | null => {
    if (!groups.length) return null;

    let bestByOverlap: DroneGroup | null = null;
    let bestOverlapScore = 0;

    for (const group of groups) {
        const extent = group.representativeExtent;
        if (!extent) continue;

        // Se ainda houver grupos com wkid diferente (não reprojetados), ignorar
        if (
            viewExtent.wkid != null &&
            extent.wkid != null &&
            viewExtent.wkid !== extent.wkid
        ) continue;

        const pct = getIntersectionPctOnSmaller(viewExtent, extent);
        if (pct > bestOverlapScore) {
            bestOverlapScore = pct;
            bestByOverlap = group;
        }
    }

    // Alguma interseção encontrada → retorna o melhor
    if (bestByOverlap && bestOverlapScore > 0) return bestByOverlap;

    // Fallback: grupo com centro mais próximo do centro da view
    const viewCenter = getExtentCenter(viewExtent);
    let bestByDist: DroneGroup | null = null;
    let bestDist: number | null = null;

    for (const group of groups) {
        const dist = distanceMeters(viewCenter, group.representativeCenter);
        if (dist != null && (bestDist == null || dist < bestDist)) {
            bestDist = dist;
            bestByDist = group;
        }
    }

    return bestByDist;
};

