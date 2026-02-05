import { create } from "zustand";
import type { ExposureRef, PanoSelection } from "./types";
import type { default as MapView } from "@arcgis/core/views/MapView";

export type LastPoint = {
    x: number;
    y: number;
    wkid?: number;
};

type ActiveMode = "map" | "swipe" | "image360";

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

    reset360: () => void;
};

export const useAppStore = create<State>((set) => ({
    activeMode: "map",
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
}));

export const selectMapView = (s: State) => s.mapView;
export const selectActiveMode = (s: State) => s.activeMode;
