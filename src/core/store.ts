// src/core/store.ts
import { create } from "zustand";
import type { ExposureRef, PanoSelection, TileSource } from "./types";
import type { default as MapView } from "@arcgis/core/views/MapView";

import { apiClient, type PlanetMosaic as PlanetMosaicBackend } from "./apiClient";

export type LastPoint = {
    x: number;
    y: number;
    wkid?: number;
};

export type DateRange = {
    start: number | null;
    end: number | null;
};

type ActiveMode = "map" | "swipe" | "image360" | "imageObra";

/* =========================
   ✅ Planet (front model)
   ========================= */
export type PlanetMosaicUI = {
    id: string;
    label: string;
    tileUrl: string; // normalizada p/ {level}/{col}/{row}
    when?: string;   // "YYYY-MM"
};

const normalizePlanetTileUrl = (url: string) =>
    url
        .replace("{TileMatrix}", "{level}")
        .replace("{TileCol}", "{col}")
        .replace("{TileRow}", "{row}");

const capturedFromId = (id: string) => {
    const m = id.match(/global_monthly_(\d{4})_(\d{2})_mosaic/i);
    return m ? `${m[1]}-${m[2]}` : undefined;
};

type State = {
    activeMode: ActiveMode;
    setActiveMode: (m: ActiveMode) => void;

    mapView: MapView | null;
    setMapView: (v: MapView | null) => void;

    candidateExposures: ExposureRef[];
    setCandidateExposures: (arr: ExposureRef[]) => void;

    selectedExposureLeft: ExposureRef | null;
    setSelectedExposureLeft: (e: ExposureRef | null) => void;

    selectedExposureRight: ExposureRef | null;
    setSelectedExposureRight: (e: ExposureRef | null) => void;

    panoLeft: PanoSelection | null;
    setPanoLeft: (p: PanoSelection | null) => void;

    panoRight: PanoSelection | null;
    setPanoRight: (p: PanoSelection | null) => void;

    compareOpen: boolean;
    setCompareOpen: (v: boolean) => void;

    lastClickedPoint: LastPoint | null;

    setLastClickedPoint: (p: LastPoint | null) => void;

    // ✅ Camadas p/ swipe (Planet / Wayback / etc)
    leftTile: TileSource | null;
    setLeftTile: (t: TileSource | null) => void;

    rightTile: TileSource | null;
    setRightTile: (t: TileSource | null) => void;

    // ✅ Layer de exposições ativo (p/ 360)
    activeExposureLayerUrl: string | null;
    setActiveExposureLayerUrl: (url: string | null) => void;

    // ✅ Filtros de Data
    droneDateFilter: DateRange;
    setDroneDateFilter: (range: DateRange) => void;

    image360DateFilter: DateRange;
    setImage360DateFilter: (range: DateRange) => void;

    image360AvailableDates: Set<string>;
    setImage360AvailableDates: (dates: Set<string>) => void;

    reset360: () => void;

    // ✅ Imagem Obra
    candidateImages: ExposureRef[];
    setCandidateImages: (arr: ExposureRef[]) => void;

    selectedImageLeft: ExposureRef | null;
    setSelectedImageLeft: (e: ExposureRef | null) => void;

    selectedImageRight: ExposureRef | null;
    setSelectedImageRight: (e: ExposureRef | null) => void;

    imageLeft: PanoSelection | null;
    setImageLeft: (p: PanoSelection | null) => void;

    imageRight: PanoSelection | null;
    setImageRight: (p: PanoSelection | null) => void;

    compareImageOpen: boolean;
    setCompareImageOpen: (v: boolean) => void;

    imageObraDateFilter: DateRange;
    setImageObraDateFilter: (range: DateRange) => void;

    imageObraAvailableDates: Set<string>;
    setImageObraAvailableDates: (dates: Set<string>) => void;

    resetImageObra: () => void;

    imageObraMapMsg: string | null;
    setImageObraMapMsg: (msg: string | null) => void;

    // ✅ Visibilidade global de grupos de camadas
    droneLayersVisible: boolean;
    setDroneLayersVisible: (v: boolean) => void;

    image360LayersVisible: boolean;
    setImage360LayersVisible: (v: boolean) => void;

    imageObraLayersVisible: boolean;
    setImageObraLayersVisible: (v: boolean) => void;

    /* =========================
       ✅ Planet mosaics (shared)
       ========================= */
    planetMosaics: PlanetMosaicUI[];
    planetMosaicsLoading: boolean;
    planetMosaicsError: string | null;

    loadPlanetMosaics: (opts?: { force?: boolean; limit?: number }) => Promise<void>;

    // mosaico ativo no MapBase (overlay)
    planetSelectedId: string | null;
    setPlanetSelectedId: (id: string | null) => void;
};

export const useAppStore = create<State>((set, get) => ({
    activeMode: "swipe",
    setActiveMode: (m) => set({ activeMode: m }),

    mapView: null,
    setMapView: (v) => set({ mapView: v }),

    candidateExposures: [],
    setCandidateExposures: (arr) => set({ candidateExposures: arr }),

    selectedExposureLeft: null,
    setSelectedExposureLeft: (e) => set({ selectedExposureLeft: e }),

    selectedExposureRight: null,
    setSelectedExposureRight: (e) => set({ selectedExposureRight: e }),

    panoLeft: null,
    setPanoLeft: (p) => set({ panoLeft: p }),

    panoRight: null,
    setPanoRight: (p) => set({ panoRight: p }),

    compareOpen: false,
    setCompareOpen: (v) => set({ compareOpen: v }),

    lastClickedPoint: null,

    setLastClickedPoint: (p) => set({ lastClickedPoint: p }),

    leftTile: null,
    setLeftTile: (t) => set({ leftTile: t }),

    rightTile: null,
    setRightTile: (t) => set({ rightTile: t }),

    activeExposureLayerUrl: null, // ou algum default se quiser
    setActiveExposureLayerUrl: (url) => set({ activeExposureLayerUrl: url }),

    droneDateFilter: { start: null, end: null },
    setDroneDateFilter: (range) => set({ droneDateFilter: range }),

    image360DateFilter: { start: null, end: null },
    setImage360DateFilter: (range) => set({ image360DateFilter: range }),

    image360AvailableDates: new Set<string>(),
    setImage360AvailableDates: (dates) => set({ image360AvailableDates: dates }),

    reset360: () =>
        set({
            candidateExposures: [],
            selectedExposureLeft: null,
            selectedExposureRight: null,
            panoLeft: null,
            panoRight: null,
            lastClickedPoint: null,
            compareOpen: false,
        }),

    candidateImages: [],
    setCandidateImages: (arr) => set({ candidateImages: arr }),

    selectedImageLeft: null,
    setSelectedImageLeft: (e) => set({ selectedImageLeft: e }),

    selectedImageRight: null,
    setSelectedImageRight: (e) => set({ selectedImageRight: e }),

    imageLeft: null,
    setImageLeft: (p) => set({ imageLeft: p }),

    imageRight: null,
    setImageRight: (p) => set({ imageRight: p }),

    compareImageOpen: false,
    setCompareImageOpen: (v) => set({ compareImageOpen: v }),

    imageObraDateFilter: { start: null, end: null },
    setImageObraDateFilter: (range) => set({ imageObraDateFilter: range }),

    imageObraAvailableDates: new Set<string>(),
    setImageObraAvailableDates: (dates) => set({ imageObraAvailableDates: dates }),

    resetImageObra: () =>
        set({
            candidateImages: [],
            selectedImageLeft: null,
            selectedImageRight: null,
            imageLeft: null,
            imageRight: null,
            lastClickedPoint: null,
            compareImageOpen: false,
        }),

    imageObraMapMsg: null,
    setImageObraMapMsg: (msg) => set({ imageObraMapMsg: msg }),

    droneLayersVisible: true,
    setDroneLayersVisible: (v) => set({ droneLayersVisible: v }),

    image360LayersVisible: true,
    setImage360LayersVisible: (v) => set({ image360LayersVisible: v }),

    imageObraLayersVisible: true,
    setImageObraLayersVisible: (v) => set({ imageObraLayersVisible: v }),

    /* =========================
       ✅ Planet mosaics
       ========================= */
    planetMosaics: [],
    planetMosaicsLoading: false,
    planetMosaicsError: null,

    planetSelectedId: null,
    setPlanetSelectedId: (id) => set({ planetSelectedId: id }),

    loadPlanetMosaics: async (opts) => {
        const force = !!opts?.force;
        const limit = opts?.limit ?? 200;

        const { planetMosaicsLoading, planetMosaics } = get();
        if (planetMosaicsLoading) return;
        if (!force && planetMosaics.length) return; // ✅ já carregado

        set({ planetMosaicsLoading: true, planetMosaicsError: null });

        try {
            // ✅ usa teu apiClient atual (mantém credentials include)
            const raw: PlanetMosaicBackend[] = await apiClient.planetMosaics("", limit);

            const items: PlanetMosaicUI[] = (raw || []).map((p) => {
                const when = p.captured || capturedFromId(p.id);
                return {
                    id: p.id,
                    label: when ? `${when} · ${p.title}` : p.title,
                    tileUrl: normalizePlanetTileUrl(p.tileUrl),
                    when,
                };
            });

            // mais recente primeiro (YYYY-MM ordena lexicograficamente)
            items.sort((a, b) => ((b.when || "") > (a.when || "") ? 1 : -1));

            set({
                planetMosaics: items,
                planetMosaicsLoading: false,
                planetMosaicsError: null,
                // ✅ default no mais recente
                planetSelectedId: items[0]?.id ?? null,
            });
        } catch (e) {
            set({
                planetMosaicsLoading: false,
                planetMosaicsError: e instanceof Error ? e.message : "Erro ao carregar mosaics",
            });
        }
    },
}));

export const selectMapView = (s: State) => s.mapView;
export const selectActiveMode = (s: State) => s.activeMode;
