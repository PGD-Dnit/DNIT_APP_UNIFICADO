//import React from "react";
import { useAppStore } from "../core/store";
import "./SideNav.css";

export default function SideNav() {
    const activeMode = useAppStore((s) => s.activeMode);
    const setActiveMode = useAppStore((s) => s.setActiveMode);

    return (
        <aside className="sidenav">
            <button
                className={`sidenav-btn ${activeMode === "map" ? "is-active" : ""}`}
                onClick={() => setActiveMode("map")}
                title="Mapa"
                aria-label="Mapa"
            >
                <i className="fa-solid fa-map" />
            </button>

            <button
                className={`sidenav-btn ${activeMode === "swipe" ? "is-active" : ""}`}
                onClick={() => setActiveMode("swipe")}
                title="Swipe"
                aria-label="Swipe"
            >
                <i className="fa-solid fa-arrows-left-right" />
            </button>

            <button
                className={`sidenav-btn ${activeMode === "image360" ? "is-active" : ""}`}
                onClick={() => setActiveMode("image360")}
                title="Imagem 360"
                aria-label="Imagem 360"
            >
                <i className="fa-solid fa-street-view" />
            </button>
        </aside>
    );
}
