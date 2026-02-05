import React, { useEffect, useRef, useState } from "react";
import TileSwipeViewer from "./TileSwipeViewer";
import FeatureServiceList from "./FeatureServiceList";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import MapView from "@arcgis/core/views/MapView";
//import MosaicCalendar from "./MosaicCalendar";
import "./SwipePage.css";
import IconCheckbox from "./IconCheckbox";
/* -------------------------------
   Tipos e helpers
-------------------------------- */
type PlanetItemRaw = {
  id: string;
  title: string;
  tileUrl: string;
};

type PlanetMosaic = {
  id: string;
  label: string;
  tileUrl: string;
  when?: string;
};

const normalizePlanetTileUrl = (url: string) =>
  url
    .replace("{TileMatrix}", "{level}")
    .replace("{TileCol}", "{col}")
    .replace("{TileRow}", "{row}");

const capturedFromId = (id: string) => {
  const m = id.match(/global_monthly_(\d{4})_(\d{2})_mosaic/i);
  return m ? `${m[1]}-${m[2]}` : undefined;
};

/* -------------------------------
   Componente principal
-------------------------------- */
const SwipePage: React.FC = () => {
  const [mosaics, setMosaics] = useState<PlanetMosaic[]>([]);
  const [featureServices, setFeatureServices] = useState<any[]>([]);
  const [erro, setErro] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const [leftTileUrl, setLeftTileUrl] = useState<string | null>(null);
  const [rightTileUrl, setRightTileUrl] = useState<string | null>(null);
  const [mapReady, setMapReady] = useState(false);

  const viewRef = useRef<MapView | null>(null);
  const activeLayersRef = useRef<{ [url: string]: FeatureLayer }>({});
  const [activeLayerUrls, setActiveLayerUrls] = useState<string[]>([]);

  // 🔘 Estado do painel de camadas (fechado por padrão)
  const [showCamadas, setShowCamadas] = useState(false);

  /* 1️⃣ Carrega mosaicos e features */
  useEffect(() => {
    const fetchData = async () => {
      try {
        const api = import.meta.env.VITE_API_URL || "http://localhost:3001";
        const [planetRes, featuresRes] = await Promise.all([
          fetch(`${api}/planet/mosaics`),
          fetch(`${api}/features`),
        ]);

        if (!planetRes.ok) throw new Error("Erro ao buscar mosaics do Planet");
        if (!featuresRes.ok) throw new Error("Erro ao buscar dados dos Features");

        const planetData: PlanetItemRaw[] = await planetRes.json();
        const featuresData = await featuresRes.json();
        console.log("planetData", planetData);
        console.log("featuresData", featuresData);
        const items: PlanetMosaic[] = (planetData || []).map((p, i) => {
          const when = capturedFromId(p.id);
          return {
            id: p.id ?? `pl-${i}`,
            label: when ? `${when} · ${p.title}` : p.title,
            tileUrl: normalizePlanetTileUrl(p.tileUrl),
            when,
          };
        });

        items.sort((a, b) => (b.when! > a.when! ? 1 : -1));
        setMosaics(items);

        if (items[0]) setLeftTileUrl(items[0].tileUrl);
        if (items[1]) setRightTileUrl(items[1].tileUrl || items[0].tileUrl);

        const featureOnly = (featuresData || []).filter((f: any) => f.featureUrl);
        console.log("Feature Services carregados:", featureOnly);
        setFeatureServices(featureOnly);
      } catch (err) {
        setErro(err instanceof Error ? err.message : "Erro ao carregar mosaics");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  /* 2️⃣ Controle de Feature Layers */
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

  if (loading) return <p>Carregando mosaics do Planet…</p>;
  if (erro) return <p>{erro}</p>;

  /* 3️⃣ URLs dos mosaicos */
  const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
  const leftUrl = leftTileUrl
    ? `${apiBase}/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaics.find(
      (m) => m.tileUrl === leftTileUrl
    )?.id}`
    : "";
  const rightUrl = rightTileUrl
    ? `${apiBase}/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaics.find(
      (m) => m.tileUrl === rightTileUrl
    )?.id}`
    : "";

  // 💡 Classe do ícone conforme estado (solid = fechado, regular = aberto)
  const iconClass = showCamadas
    ? "fa-solid fa-xmark"
    : "fa-solid fa-layer-group";

  /* 4️⃣ Renderização */
  return (
    <div id="webmap-container">
      {/* Calendário esquerdo */}
      {/* <aside className="lista">
        <MosaicCalendar
          mosaics={mosaics.map((m) => ({
            mosaic_name: m.id,
            date: m.when || "2025-01",
          }))}
          title="🗓️ Mosaico Esquerdo"
          align="left"
          onSelect={(m) => {
            const found = mosaics.find((mo) => mo.id === m.mosaic_name);
            if (found) setLeftTileUrl(found.tileUrl);
          }}
        />
      </aside> */}

      {/* Viewer central */}
      <section id="mapa">
        {leftUrl && rightUrl ? (
          <>
            <TileSwipeViewer
              leftTileUrl={leftUrl}
              rightTileUrl={rightUrl}
              mosaics={mosaics} // ✅ adiciona aqui!
              titleLeft={
                (() => {
                  const when = mosaics.find((m) => m.tileUrl === leftTileUrl)?.when;
                  if (!when) return "?";
                  const [y, mo] = when.split("-");
                  return `${mo}/${y}`;
                })()
              }
              titleRight={
                (() => {
                  const when = mosaics.find((m) => m.tileUrl === rightTileUrl)?.when;
                  if (!when) return "?";
                  const [y, mo] = when.split("-");
                  return `${mo}/${y}`;
                })()
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

            {/* Ícone flutuante que abre/fecha o painel */}
            {/* Ícone flutuante para abrir/fechar */}
            <i
              className={`${iconClass} btn-camadas-icon`}
              title={showCamadas ? "Esconder camadas" : "Mostrar camadas"}
              onClick={() => setShowCamadas(!showCamadas)}
            ></i>

            {/* Painel de camadas (drawer) */}
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

      {/* Calendário direito */}
      {/* <aside className="lista">
        <MosaicCalendar
          mosaics={mosaics.map((m) => ({
            mosaic_name: m.id,
            date: m.when || "2025-01",
          }))}
          title="🗓️ Mosaico Direito"
          align="right"
          onSelect={(m) => {
            const found = mosaics.find((mo) => mo.id === m.mosaic_name);
            if (found) setRightTileUrl(found.tileUrl);
          }}
        />
      </aside> */}
    </div>
  );
};

export default SwipePage;
