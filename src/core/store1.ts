import { create } from "zustand";
import type { ExposureRef, LocationPoint, SwipeConfig } from "./types";
import type { TileSource } from "./types";
import type { PanoSelection } from "./types";

type AppState = {
  activeMode: "both" | "swipe" | "360";
  setActiveMode: (m: AppState["activeMode"]) => void;

  selectedLocation: LocationPoint | null;
  setSelectedLocation: (p: LocationPoint | null) => void;

  selectedExposure: ExposureRef | null;
  setSelectedExposure: (e: ExposureRef | null) => void;

  swipe: SwipeConfig;
  setSwipe: (patch: Partial<SwipeConfig>) => void;

  leftTile: TileSource | null;
  rightTile: TileSource | null;
  setLeftTile: (t: TileSource | null) => void;
  setRightTile: (t: TileSource | null) => void;

  activeExposureLayerUrl: string | null; // qual FeatureLayer (360) está ativa
  setActiveExposureLayerUrl: (url: string | null) => void;

    pano: PanoSelection | null;
  setPano: (p: PanoSelection | null) => void;

compareOpen: boolean;
setCompareOpen: (v: boolean) => void;


  
};

export const useAppStore = create<AppState>((set) => ({
  activeMode: "both",
  setActiveMode: (m) => set({ activeMode: m }),

  selectedLocation: null,
  setSelectedLocation: (p) => set({ selectedLocation: p }),

  selectedExposure: null,
  setSelectedExposure: (e) => set({ selectedExposure: e }),

  swipe: { position: 50, leftTitle: "LEFT", rightTitle: "RIGHT" },
  setSwipe: (patch) => set((s) => ({ swipe: { ...s.swipe, ...patch } })),
  leftTile: null,
rightTile: null,
setLeftTile: (t) => set({ leftTile: t }),
setRightTile: (t) => set({ rightTile: t }),

activeExposureLayerUrl: null,
setActiveExposureLayerUrl: (url) => set({ activeExposureLayerUrl: url }),

  pano: null,
  setPano: (p) => set({ pano: p }),

    compareOpen: false,
setCompareOpen: (v: boolean) => set({ compareOpen: v }),


}));
