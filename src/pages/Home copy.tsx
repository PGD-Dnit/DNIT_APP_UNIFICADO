import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Map from "@arcgis/core/Map";
// ArcGIS JS (instale se ainda não: npm i @arcgis/core)
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";

import "./Home.css";

type Props = {
  //webmapId?: string;       // se quiser passar por props
  basemap?: string;
  center?: [number, number];
  zoom?: number;
};

export default function Home({
  //webmapId = "id",
  basemap = "hybrid",
  center = [-51, -14], // Brasil aproximado
  zoom = 4,
}: Props) {
  const navigate = useNavigate();
  const mapDivRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);

  const [goSwipe, setGoSwipe] = useState(false);
  const [go360, setGo360] = useState(false);

  // 1) Cria um único MapView full-screen
  useEffect(() => {
    if (!mapDivRef.current) return;

    const map = new Map({ basemap });
    /* const webmap = new WebMap({
      portalItem: { id: webmapId },
    });
 */
    const view = new MapView({
      container: mapDivRef.current,
      //map: webmap,
      map,
      center,
      zoom,
      ui: {
        components: [], // tira UI padrão (zoom, attribution etc) se quiser limpo
      },
    });

    viewRef.current = view;

    return () => {
      viewRef.current?.destroy();
      viewRef.current = null;
    };
  }, [basemap, center, zoom]);

  // 2) Navegação ao ligar a chave
  useEffect(() => {
    if (goSwipe) navigate("/app/swipe");    // ajuste sua rota
  }, [goSwipe, navigate]);

  useEffect(() => {
    if (go360) navigate("/app/mapapanel");   // ajuste sua rota
  }, [go360, navigate]);

  return (
    <div className="homeRoot">
      <div ref={mapDivRef} className="homeMap" />

      <div className="homeOverlay">
        <SwitchRow
          label="SWIPE DNIT"
          checked={goSwipe}
          onChange={setGoSwipe}
        />
        <SwitchRow
          label="IMAGEM 360"
          checked={go360}
          onChange={setGo360}
        />
      </div>
    </div>
  );
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="switchRow">
      <span className="switchLabel">{label}</span>

      <span className="switchWrap">
        <input
          className="switchInput"
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="switchTrack" />
        <span className="switchThumb" />
      </span>
    </label>
  );
}
