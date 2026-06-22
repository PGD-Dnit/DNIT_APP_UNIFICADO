// src/core/AppInit.tsx
import React, { useEffect } from "react";
import { useAppStore } from "./store";

import ComparePanoScreen from "../modules/imagem_360/ComparePanoScreen";
import Image360Panel from "../modules/imagem_360/Image360Panel";
import { Setup360OnView } from "../modules/imagem_360/Setup360OnView";

import CompareImageScreen from "../modules/imagem_obra/CompareImageScreen";
import { SetupImageOnView } from "../modules/imagem_obra/SetupImageOnView";

export default function AppInit() {
  const compareOpen = useAppStore((s) => s.compareOpen);
  const compareImageOpen = useAppStore((s) => s.compareImageOpen);
  const view = useAppStore((s) => s.mapView);
  const activeMode = useAppStore((s) => s.activeMode);
  const imageObraMapMsg = useAppStore((s) => s.imageObraMapMsg);

  useEffect(() => {
    if (!view) return;
    if (activeMode !== "image360" && activeMode !== "imageObra" && activeMode !== "map") return;

    let cancelled = false;
    let cleanup360: void | (() => void);
    let cleanupImage: void | (() => void);

    view.when().then(() => {
      if (cancelled) return;
      if (activeMode === "image360" || activeMode === "map") cleanup360 = Setup360OnView(view);
      if (activeMode === "imageObra" || activeMode === "map") cleanupImage = SetupImageOnView(view);
    }).catch((err) => {
      console.error("view.when() falhou no AppInit:", err);
    });

    return () => {
      cancelled = true;
      cleanup360?.();
      cleanupImage?.();
    };
  }, [view, activeMode]);

  if (compareOpen) return <ComparePanoScreen />;
  if (compareImageOpen) return <CompareImageScreen />;

  if (activeMode === "image360") {
    return (
      <div style={styles.root}>
        <div style={styles.panel}>
          <Image360Panel />
        </div>
      </div>
    );
  }

  // Toast de "sem imagem" no mapa principal (modo imageObra ou map)
  if ((activeMode === "imageObra" || activeMode === "map") && imageObraMapMsg) {
    return (
      <div style={styles.root}>
        <div style={styles.toast}>
          <i className="fa-solid fa-triangle-exclamation" style={{ marginRight: 8, opacity: 0.85 }} />
          {imageObraMapMsg}
        </div>
      </div>
    );
  }

  return null;
}

const styles: Record<string, React.CSSProperties> = {
  root: { position: "absolute", inset: 0, pointerEvents: "none" },
  panel: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 420,
    height: "calc(100% - 24px)",
    borderRadius: 16,
    background: "rgba(0,0,0,0.55)",
    backdropFilter: "blur(6px)",
    border: "1px solid rgba(255,255,255,0.12)",
    pointerEvents: "auto",
    overflow: "hidden",
  },
  minimap: { position: "absolute", left: 12, bottom: 12, pointerEvents: "auto" },
  toast: {
    position: "absolute",
    bottom: 80,
    left: "50%",
    transform: "translateX(-50%)",
    background: "rgba(30, 20, 10, 0.92)",
    backdropFilter: "blur(8px)",
    border: "1px solid rgba(255, 180, 60, 0.4)",
    color: "rgba(255, 200, 80, 0.95)",
    padding: "10px 20px",
    borderRadius: 10,
    fontSize: 13,
    fontWeight: 600,
    pointerEvents: "none",
    whiteSpace: "nowrap",
    boxShadow: "0 4px 20px rgba(0,0,0,0.5)",
    animation: "fadeIn 0.2s ease",
  },
};
