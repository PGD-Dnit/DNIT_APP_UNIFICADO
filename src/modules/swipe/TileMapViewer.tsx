import React, { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Swipe from "@arcgis/core/widgets/Swipe";
//import "@arcgis/core/assets/esri/themes/light/main.css";

interface Props {
  leftTileUrl: string;
  rightTileUrl: string;
  height?: number | string;
  onViewReady?: (view: MapView) => void;
}

const TileSwipeViewer: React.FC<Props> = ({
  leftTileUrl,
  rightTileUrl,
  height = 500,
  onViewReady,
}) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const swipeRef = useRef<Swipe | null>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    // Cria as camadas de tile
    const leftLayer = new WebTileLayer({
      urlTemplate: leftTileUrl,
      title: "Mapa Esquerdo",
    });

    const rightLayer = new WebTileLayer({
      urlTemplate: rightTileUrl,
      title: "Mapa Direito",
    });

    // Cria o mapa e o view
    const map = new Map({
      layers: [leftLayer, rightLayer],
    });

    const view = new MapView({
      container: mapRef.current,
      map,
      center: [-47.93, -15.78], // Brasília
      zoom: 5,
    });

    // Quando o view estiver pronto, adiciona o Swipe e chama o callback
    view.when(() => {
      const swipe = new Swipe({
        view,
        leadingLayers: [leftLayer],
        trailingLayers: [rightLayer],
        position: 50,
      });

      view.ui.add(swipe);
      swipeRef.current = swipe;

      if (onViewReady) {
        onViewReady(view);
      }
    });

    viewRef.current = view;

    // Cleanup
    return () => {
      if (swipeRef.current) {
        view.ui.remove(swipeRef.current);
        swipeRef.current.destroy();
        swipeRef.current = null;
      }
      view.destroy();
      viewRef.current = null;
    };
  }, [leftTileUrl, rightTileUrl, onViewReady]);

  return (
    <div
      ref={mapRef}
      style={{
        height: typeof height === "number" ? `${height}px` : height,
        marginTop: 20,
      }}
    />
  );
};

export default TileSwipeViewer;
