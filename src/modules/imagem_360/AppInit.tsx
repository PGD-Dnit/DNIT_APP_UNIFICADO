import React, { useEffect } from "react";
import { useAppStore } from "../../core/store";

import ComparePanoScreen from "../imagem_360/ComparePanoScreen";
import Image360Panel from "../imagem_360/Image360Panel";
import MiniMap360View from "../imagem_360/MiniMap360View";
import { Setup360OnView } from "../imagem_360/Setup360OnView";

export default function AppInit() {
  const compareOpen = useAppStore((s) => s.compareOpen);
  const view = useAppStore((s) => s.mapView);
  const activeMode = useAppStore((s) => s.activeMode);
  //console.log("activeMode", activeMode);
  //console.log("view", view);
  //console.log("compareOpen", compareOpen);
  useEffect(() => {
    if (!view) return;
    if (activeMode !== "image360") return;

    let cancelled = false;
    let cleanup: void | (() => void);

    view.when().then(() => {
      if (cancelled) return;
      cleanup = Setup360OnView(view);
    }).catch((err) => {
      console.error("view.when() falhou no AppInit:", err);
    });

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [view, activeMode]);



  if (compareOpen) return <ComparePanoScreen />;

  if (activeMode !== "image360") return null;

  return (
    <div style={styles.root}>
      <div style={styles.panel}>
        <Image360Panel />
      </div>


    </div>
  );
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
};
