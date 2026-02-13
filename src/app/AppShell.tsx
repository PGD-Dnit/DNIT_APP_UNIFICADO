// src/app/AppShell.tsx
import React from "react";
import { useAppStore } from "../core/store";

import MapBase from "../modules/map/MapBase";

import SideNav from "./SideNav"; // ajuste path

// ajuste estes imports para os seus componentes reais:
import SwipePage from "../modules/swipe/SwipePage";
import AppInit from "../modules/imagem_360/AppInit"; // ou Image360Panel

import ErrorBoundary from "../core/ErrorBoundary";

export default function AppShell() {
  const activeMode = useAppStore((s) => s.activeMode);
  //const setActiveMode = useAppStore((s) => s.setActiveMode);

  //const inMap = activeMode === "map";
  const inSwipe = activeMode === "swipe";
  const in360 = activeMode === "image360";

  return (
    <div style={styles.shell}>
      <header style={styles.topbar}>
        {/*  <div style={styles.brand} onClick={() => setActiveMode("map")} title="Mapa">
          DNIT • Swipe/360
        </div>

        <div style={styles.nav}>
          <button style={{ ...styles.btn, ...(inMap ? styles.btnActive : null) }} onClick={() => setActiveMode("map")}>
            Mapa
          </button>

          <button style={{ ...styles.btn, ...(inSwipe ? styles.btnActive : null) }} onClick={() => setActiveMode("swipe")}>
            Swipe
          </button>

          <button style={{ ...styles.btn, ...(in360 ? styles.btnActive : null) }} onClick={() => setActiveMode("image360")}>
            360
          </button>
        </div> */}
      </header>

      <main style={styles.body}>
        {/* ✅ Mapa base sempre montado */}
        <MapBase />

        {/* ✅ menu lateral por cima do mapa */}
        <SideNav />

        {/* ✅ Overlay Swipe: só monta quando está em Swipe (serviço nasce/morre junto) */}
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

        {/* ✅ Overlay 360 */}
        {in360 && (
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
  brand: { fontWeight: 700, cursor: "pointer", userSelect: "none" },
  nav: { display: "flex", gap: 8 },
  btn: {
    height: 32,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid rgba(255,255,255,0.15)",
    background: "transparent",
    color: "inherit",
    cursor: "pointer",
    fontSize: 13,
  },
  btnActive: { background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.25)" },
  body: { flex: 1, overflow: "hidden", position: "relative" },

  overlay: {
    position: "absolute",
    inset: 0,
    zIndex: 10,
    transition: "opacity 160ms ease, transform 160ms ease",
  },
};
