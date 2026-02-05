// src/core/store.ts
import { create } from "zustand";

export type Exposure = {
  objectId: number;
  layerUrl: string;                 // <- usado pra montar URL do attachment
  name?: string | null;
  acquisitionDate?: number | null;  // epoch ms (ou null)
  cameraHeading?: number | null;
};

type State = {
  // modo da app (se você usa)
  activeMode: "home" | "swipe" | "mapapanel" | "both";
  setActiveMode: (m: State["activeMode"]) => void;

  // layer ativa (se você usa pra saber qual camada está selecionada)
  activeExposureLayerUrl: string | null;
  setActiveExposureLayerUrl: (url: string | null) => void;

  // o ponto clicado no mapa (o que o Image360Panel vai consumir)
  selectedExposure: Exposure | null;
  setSelectedExposure: (e: Exposure | null) => void;

  // opcional: seu fluxo de comparação/dual viewer (se já existe)
  compareOpen: boolean;
  setCompareOpen: (v: boolean) => void;
};

export const useAppStore = create<State>((set) => ({
  activeMode: "home",
  setActiveMode: (m) => set({ activeMode: m }),

  activeExposureLayerUrl: null,
  setActiveExposureLayerUrl: (url) => set({ activeExposureLayerUrl: url }),

  selectedExposure: null,
  setSelectedExposure: (e) => set({ selectedExposure: e }),

  compareOpen: false,
  setCompareOpen: (v) => set({ compareOpen: v }),
}));
