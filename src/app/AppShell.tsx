// src/app/AppShell.tsx
import React, { useCallback } from "react";
import { useAppStore } from "../core/store";

import MapBase from "../modules/map/MapBase";
import SwipePage from "../modules/swipe/SwipePage";
import SingleMapPage from "../modules/swipe/SingleMapPage";
import AppInit from "../core/AppInit";
import ErrorBoundary from "../core/ErrorBoundary";
import ObraDetailsModal from "../components/ObraDetailsModal";

export default function AppShell() {
  const activeMode = useAppStore((s) => s.activeMode);
  const selectedObraQuery = useAppStore((s) => s.selectedObraQuery);
  const setSelectedObraQuery = useAppStore((s) => s.setSelectedObraQuery);
  const handleCloseObraModal = useCallback(() => setSelectedObraQuery(null), [setSelectedObraQuery]);

  const inSwipe = activeMode === "swipe";
  const in360 = activeMode === "image360";
  const inImageObra = activeMode === "imageObra";
  const inMapaInicial = activeMode === "mapa_inicial";

  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
      </header>

      <main style={styles.body}>
        <MapBase />

        {inSwipe && (
          <div
            style={{
              ...styles.overlay,
              pointerEvents: "auto",
              opacity: 1,
              transform: "translateX(0)",
            }}
          >
            <SwipePage />
          </div>
        )}

        {inMapaInicial && (
          <div
            style={{
              ...styles.overlay,
              pointerEvents: "auto",
              opacity: 1,
              transform: "translateX(0)",
            }}
          >
            <SingleMapPage />
          </div>
        )}

        {(in360 || inImageObra || activeMode === "map") && (
          <div
            style={{
              ...styles.overlay,
              pointerEvents: "none",
              opacity: 1,
              transform: "translateX(0)",
            }}
          >
            <ErrorBoundary>
              <AppInit />
            </ErrorBoundary>
          </div>
        )}

        {selectedObraQuery && (
          <ObraDetailsModal
            id={selectedObraQuery.id}
            globalid={selectedObraQuery.globalid}
            onClose={handleCloseObraModal}
          />
        )}
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  shell: {
    height: "100vh",
    width: "100vw",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "#140b0bff",
    color: "#e8eef6",
  },
  topbar: {
    height: 2,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 12px",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    background: "#210f0fff",
    zIndex: 20,
  },
  body: { flex: 1, overflow: "hidden", position: "relative" },

  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    transition: "opacity 160ms ease, transform 160ms ease",
  },
};
