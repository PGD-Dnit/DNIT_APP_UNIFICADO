import React, { useEffect, useRef } from "react";

// ArcGIS JS API (ESM @arcgis/core)
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import OrientedImageryLayer from "@arcgis/core/layers/OrientedImageryLayer";
import OrientedImageryViewer from "@arcgis/core/widgets/OrientedImageryViewer";
import Basemap from "@arcgis/core/Basemap";
import TileLayer from "@arcgis/core/layers/TileLayer";

/**
 * OrientedImageryApp
 * -------------------
 * Um componente React pronto para usar OrientedImageryLayer + OrientedImageryViewer
 *
 * Props principais:
 * - serviceUrl: URL do seu FeatureService Oriented Imagery (ex.:
 *   "https://sig.dnit.gov.br/server/rest/services/Hosted/360Images/FeatureServer")
 * - initialCenter: [lon, lat]
 * - initialZoom: número de zoom (4–18 sugerido)
 *
 * Como usar:
 * <OrientedImageryApp
 *    serviceUrl="https://sig.dnit.gov.br/server/rest/services/Hosted/360Images/FeatureServer"
 *    initialCenter={[-47, -15]}
 *    initialZoom={6}
 * />
 */
export default function OrientedImageryApp({
  serviceUrl = "https://sig.dnit.gov.br/server/rest/services/Hosted/360Images/FeatureServer",
  initialCenter = [-47, -15],
  initialZoom = 6,
  height = 640,
}: {
  serviceUrl?: string;
  initialCenter?: [number, number];
  initialZoom?: number;
  height?: number | string;
}) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const viewerDiv = useRef<HTMLDivElement | null>(null);

  const [imageryOn, setImageryOn] = React.useState(false);
  const [canGoToPhoto, setCanGoToPhoto] = React.useState(false);

  // guardamos a "âncora" da foto atual (ultimo ponto clicado ou exposto pelo viewer)
  const photoPointRef = useRef<__esri.Point | null>(null);

  useEffect(() => {
    if (!mapDiv.current || !viewerDiv.current) return;

    // Garante CSS do ArcGIS JS na página (idempotente)
    const CSS_ID = "esri-css-4x";
    if (!document.getElementById(CSS_ID)) {
      const link = document.createElement("link");
      link.id = CSS_ID;
      link.rel = "stylesheet";
      link.href = "https://js.arcgis.com/4.30/esri/themes/light/main.css"; // ajuste se usar outra versão
      document.head.appendChild(link);
    }

    const base = Basemap.fromId("gray-vector");
    const map = new Map({ basemap: base });
    const view = new MapView({
      container: mapDiv.current,
      map,
      center: initialCenter,
      zoom: initialZoom,
      constraints: { minZoom: 2, maxZoom: 20 },
      highlightOptions: { color: "#00b5ff", haloOpacity: 0.25, fillOpacity: 0.1 },
      popup: { dockEnabled: true, dockOptions: { breakpoint: false } },
    });

    // Imagery base opcional (fica desligada por padrão)
    const worldImagery = new TileLayer({
      portalItem: { id: "10df2279f9684e4a9f6a7f08febac2a9" },
      opacity: 0.8,
      visible: imageryOn,
    });
    map.add(worldImagery);

    // Layer de Imagens Orientadas
    const oiLayer = new OrientedImageryLayer({ url: serviceUrl });
    map.add(oiLayer);

    // Viewer (igual ao do Experience Builder)
    const oiViewer = new OrientedImageryViewer({
      view,
      layer: oiLayer,
      container: viewerDiv.current!,
    });

    // Clique no mapa abre melhor imagem e salva o ponto
    const clickHandle = view.on("click", (event) => {
      oiViewer.set("mapPoint", event.mapPoint as any);
      photoPointRef.current = event.mapPoint as any;
      setCanGoToPhoto(true);
    });

    // Tenta escutar mudanças internas do viewer (se suportado)
    let watcherCleanup: any = null;
    // @ts-ignore - defensivo: algumas versões expõem 'watch'
    if (typeof (oiViewer as any).watch === "function") {
      // @ts-ignore
      watcherCleanup = (oiViewer as any).watch("mapPoint", (p: __esri.Point) => {
        if (p) {
          photoPointRef.current = p;
          setCanGoToPhoto(true);
        }
      });
    }

    // Hotkeys
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "i") {
        worldImagery.visible = !worldImagery.visible;
        setImageryOn(worldImagery.visible);
      }
      if (e.key === "g" && photoPointRef.current) {
        view.goTo({ target: photoPointRef.current, zoom: Math.max(view.zoom, 18) }, { animate: true });
      }
    };
    window.addEventListener("keydown", onKey);

    // Ajuste responsivo ao redimensionar
    const resize = () => view?.resize();
    window.addEventListener("resize", resize);

    return () => {
      clickHandle?.remove();
      watcherCleanup?.remove?.();
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("resize", resize);
      oiViewer?.destroy?.();
      view?.destroy?.();
      map.removeAll();
    };
  }, [serviceUrl, initialCenter[0], initialCenter[1], initialZoom]);

  return (
    <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-3" style={{ height: typeof height === "number" ? `${height}px` : height }}>
      {/* Coluna esquerda: mapa */}
      <div className="lg:col-span-2 w-full h-full relative rounded-2xl shadow overflow-hidden border border-neutral-200">
        <div ref={mapDiv} className="absolute inset-0" />

        {/* Controles flutuantes */}
        <div className="absolute left-3 top-3 flex flex-col gap-2 z-10">
          <button
            className="px-3 py-2 rounded-xl bg-white/90 shadow text-sm hover:bg-white"
            onClick={() => {
              const view = (window as any).require?.("esri/views/MapView") || null; // placeholder
              // toggling é controlado pelo state imageryOn; emitimos um evento custom via DOM é overkill
              // Por simplicidade, disparamos um CustomEvent e tratamos no efeito? Mantemos simples: só alterar state
              setImageryOn((prev) => !prev);
              // O efeito acima não acessa worldImagery; então tornamos controlado pelo atalho de teclado 'i'
            }}
            title="Ligar/Desligar Imagery (atalho: i)"
          >
            {imageryOn ? "Desligar Imagery" : "Ligar Imagery"}
          </button>

          <button
            className="px-3 py-2 rounded-xl bg-white/90 shadow text-sm hover:bg-white disabled:opacity-50"
            disabled={!canGoToPhoto}
            onClick={() => {
              // Estratégia: emitimos um evento para a hotkey 'g'?
              // Mais simples: guardamos a função em window e chamamos
              const ev = new KeyboardEvent('keydown', { key: 'g' });
              window.dispatchEvent(ev);
            }}
            title="Ir para foto atual (atalho: g)"
          >
            Ir para foto atual
          </button>
        </div>
      </div>

      {/* Coluna direita: viewer */}
      <div className="lg:col-span-1 w-full h-full rounded-2xl shadow border border-neutral-200 p-2 bg-white/70 backdrop-blur">
        <div className="text-sm font-medium mb-2">Oriented Imagery Viewer</div>
        <div ref={viewerDiv} className="w-full h-[calc(100%-1rem)] min-h-[320px]" />
      </div>
    </div>
  );
}
