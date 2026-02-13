import React, { useEffect, useRef, useState } from "react";
import TileSwipeViewer from "./TileSwipeViewer";
import FeatureServiceList from "./FeatureServiceList";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import MapView from "@arcgis/core/views/MapView";

import "./SwipePage.css";
import { useAppStore } from "../../core/store";
import { CONFIG } from "../../core/config";

const SwipePage: React.FC = () => {
  /* =========================
     Planet mosaics (store)
     ========================= */
  const mosaics = useAppStore((s) => s.planetMosaics);
  const mosaicsLoading = useAppStore((s) => s.planetMosaicsLoading);
  const mosaicsError = useAppStore((s) => s.planetMosaicsError);
  const loadPlanetMosaics = useAppStore((s) => s.loadPlanetMosaics);

  const setPlanetSelectedId = useAppStore((s) => s.setPlanetSelectedId);

  /* =========================
     Swipe state
     ========================= */
  const [leftMosaicId, setLeftMosaicId] = useState<string | null>(null);
  const [rightMosaicId, setRightMosaicId] = useState<string | null>(null);

  const [featureServices, setFeatureServices] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loadingFeatures, setLoadingFeatures] = useState(true);

  const [mapReady, setMapReady] = useState(false);
  const [showCamadas, setShowCamadas] = useState(false);

  const viewRef = useRef<MapView | null>(null);
  const activeLayersRef = useRef<{ [url: string]: FeatureLayer }>({});
  const [activeLayerUrls, setActiveLayerUrls] = useState<string[]>([]);

  /* 1️⃣ Carrega mosaics (1x via store) */
  useEffect(() => {
    loadPlanetMosaics();
  }, [loadPlanetMosaics]);

  /* 2️⃣ Define defaults do swipe */
  useEffect(() => {
    if (!mosaics.length) return;

    if (!leftMosaicId) {
      setLeftMosaicId(mosaics[0].id);
      setPlanetSelectedId(mosaics[0].id); // 🔗 sincroniza MapBase
    }

    if (!rightMosaicId) {
      setRightMosaicId((mosaics[0] || mosaics[0]).id);
    }
  }, [mosaics, leftMosaicId, rightMosaicId, setPlanetSelectedId]);

  /* 3️⃣ Carrega Feature Services */
  useEffect(() => {
    const fetchFeatures = async () => {
      try {
        const r = await fetch(`${CONFIG.API_BASE}/features`, {
          credentials: "include",
        });
        if (!r.ok) throw new Error("Erro ao buscar dados dos Features");

        const data = await r.json();
        const featureOnly = (data || []).filter((f: any) => f.featureUrl);
        setFeatureServices(featureOnly);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao carregar features");
      } finally {
        setLoadingFeatures(false);
      }
    };

    fetchFeatures();
  }, []);

  /* 4️⃣ Toggle Feature Layers */
  const handleToggleLayer = (layerUrl: string, visible: boolean) => {
    const view = viewRef.current;
    if (!view) return;

    if (visible) {
      if (activeLayersRef.current[layerUrl]) return;

      const layer = new FeatureLayer({ url: layerUrl });
      view.map?.add(layer);
      activeLayersRef.current[layerUrl] = layer;
      setActiveLayerUrls((prev) => [...prev, layerUrl]);
    } else {
      const layer = activeLayersRef.current[layerUrl];
      if (layer) {
        view.map?.remove(layer);
        delete activeLayersRef.current[layerUrl];
      }
      setActiveLayerUrls((prev) => prev.filter((u) => u !== layerUrl));
    }
  };

  /* =========================
     Loading / Error
     ========================= */
  if (mosaicsLoading || loadingFeatures) return <p>Carregando…</p>;
  if (mosaicsError) return <p>{mosaicsError}</p>;
  if (erro) return <p>{erro}</p>;

  /* =========================
     URLs finais do swipe
     ========================= */
  const left = mosaics.find((m) => m.id === leftMosaicId);
  const right = mosaics.find((m) => m.id === rightMosaicId) || left;

  const leftUrl = left
    ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${left.id}`
    : "";

  const rightUrl = right
    ? `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${right.id}`
    : "";

  const iconClass = showCamadas
    ? "fa-solid fa-xmark"
    : "fa-solid fa-layer-group";

  return (
    <div id="webmap-container">
      <section id="mapa">
        {leftUrl && rightUrl ? (
          <>
            <TileSwipeViewer
              leftTileUrl={leftUrl}
              rightTileUrl={rightUrl}
              mosaics={mosaics}
              titleLeft={
                left?.when
                  ? (() => {
                    const [y, mo] = left.when.split("-");
                    return `${mo}/${y}`;
                  })()
                  : "?"
              }
              titleRight={
                right?.when
                  ? (() => {
                    const [y, mo] = right.when.split("-");
                    return `${mo}/${y}`;
                  })()
                  : "?"
              }
              onViewReady={(view) => {
                viewRef.current = view;

                activeLayerUrls.forEach((url) => {
                  const layer = new FeatureLayer({ url });
                  view.map?.add(layer);
                  activeLayersRef.current[url] = layer;
                });

                setMapReady(true);
              }}
            />

            {/* botão flutuante */}
            <i
              className={`${iconClass} btn-camadas-icon`}
              title={showCamadas ? "Esconder camadas" : "Mostrar camadas"}
              onClick={() => setShowCamadas(!showCamadas)}
            />

            {/* painel de camadas */}
            <div className={`camadas ${showCamadas ? "aberta" : "fechada"}`}>
              <h5>Camadas</h5>
              <FeatureServiceList
                services={featureServices.map((fs: any) => ({
                  id: fs.id,
                  title: fs.title,
                  featureUrl: fs.featureUrl,
                }))}
                onToggleLayer={handleToggleLayer}
                visible={mapReady}
                activeLayerUrls={activeLayerUrls}
              />
            </div>
          </>
        ) : (
          <p>Selecione dois mosaicos para comparar</p>
        )}
      </section>
    </div>
  );
};

export default SwipePage;
