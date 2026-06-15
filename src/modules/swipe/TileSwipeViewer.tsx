import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Swipe from "@arcgis/core/widgets/Swipe";
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";
import TemporalLayersPanel from "./TemporalLayersPanel";
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import "./TileSwipeViewer.css";
import { buildPlanetTileUrl } from "../../core/mosaicUtils";
import { useAppStore } from "../../core/store";
import MapToolbar from "../../components/MapToolbar";


interface Props {
  leftTileUrl: string;
  rightTileUrl: string;
  titleLeft?: string;
  titleRight?: string;
  mosaics?: any[];
  initialViewpoint?: __esri.Viewpoint;
  onViewReady?: (view: __esri.MapView, swipeWidget: __esri.Swipe) => void;
  onMosaicChange?: (side: "left" | "right", mosaicId: string) => void;
  droneDates?: Set<string>;
  onDroneDateClick?: (side: "left" | "right", dayKey: string) => void;
}

export default function TileSwipeViewer({
  leftTileUrl,
  rightTileUrl,
  titleLeft = "Mosaico Esquerdo",
  titleRight = "Mosaico Direito",
  mosaics = [],
  initialViewpoint,
  onViewReady,
  onMosaicChange,
  droneDates,
  onDroneDateClick,
}: Props) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const leftLayerRef = useRef<WebTileLayer | null>(null);
  const rightLayerRef = useRef<WebTileLayer | null>(null);

  const setLastViewpoint = useAppStore((s) => s.setLastViewpoint);

  // 🗓️ Painel temporal — estado no store para persistir entre trocas de modo
  const showTemporalPanel = useAppStore((s) => s.showTemporalPanel);
  const setShowTemporalPanel = useAppStore((s) => s.setShowTemporalPanel);

  const [selectedSidePanel, setSelectedSidePanel] = useState<"left" | "right">("left");

  // 🌍 URLs ativas das camadas
  const [currentLeft, setCurrentLeft] = useState(leftTileUrl);
  const [currentRight, setCurrentRight] = useState(rightTileUrl);

  // 🏷️ Labels exibidos nos painéis flutuantes
  const [labelLeft, setLabelLeft] = useState(titleLeft);
  const [labelRight, setLabelRight] = useState(titleRight);

  // 📆 Seleção persistente de mês/ano (mantém ativo mesmo ao fechar)
  const [, setSelectedLeft] = useState<{ year: number; month: number } | null>(null);
  const [, setSelectedRight] = useState<{ year: number; month: number } | null>(null);

  /** 🔧 Inicializa mapa e Swipe */
  useEffect(() => {
    if (!mapDiv.current) return;

    const map = new Map({ basemap: "hybrid" });

    // Se não temos um viewpoint inicial, aplicamos o centro e zoom padrão
    const defaultProps = initialViewpoint
      ? { viewpoint: initialViewpoint }
      : {
        center: [-53, -15.8],
        zoom: 4,
        extent: {
          xmin: -75,
          ymin: -35,
          xmax: -30,
          ymax: 10,
          spatialReference: { wkid: 4326 },
        }
      };

    const view = new MapView({
      container: mapDiv.current,
      map,
      ...defaultProps,
      constraints: {
        snapToZoom: false,
        minZoom: 4,
        maxZoom: 22,
        rotationEnabled: true,
      },
    });
    viewRef.current = view;

    // 🔍 Widget de busca
    const searchWidget = new Search({
      view,
      includeDefaultSources: true,
      locationEnabled: true,
      popupEnabled: true,
      resultGraphicEnabled: true,
    });
    view.ui.add(searchWidget, { position: "top-right", index: 0 });

    // 🧭 Bússola
    const compass = new Compass({ view });
    view.ui.add(compass, "top-right");

    // 🗺️ Camadas
    const leftLayer = new WebTileLayer({
      urlTemplate: currentLeft || "",
      title: "Mosaico Esquerdo",
      visible: !!currentLeft,
    });

    const rightLayer = new WebTileLayer({
      urlTemplate: currentRight || "",
      title: "Mosaico Direito",
      visible: !!currentRight,
    });

    leftLayerRef.current = leftLayer;
    rightLayerRef.current = rightLayer;
    map.addMany([leftLayer, rightLayer]);

    // 👁️ Swipe
    const swipe = new Swipe({
      leadingLayers: [leftLayer],
      trailingLayers: [rightLayer],
      position: 50,
      view,
      direction: "horizontal",
    });
    view.ui.add(swipe);

    const zoom = view.ui.find("zoom");
    if (zoom) {
      const container = (zoom as any).container as HTMLElement;
      Object.assign(container.style, {
        borderRadius: "10%",
        overflow: "hidden",

      });
    }

    const vpWatch = reactiveUtils.watch(
      () => view.viewpoint,
      (vp) => {
        if (vp) {
          setLastViewpoint(vp.clone());
        }
      }
    );

    view.when(() => {
      if (initialViewpoint && initialViewpoint.rotation) {
        view.rotation = initialViewpoint.rotation;
      }
      if (onViewReady) onViewReady(view, swipe);
    });

    return () => {
      try { vpWatch.remove(); } catch { }
      swipe.destroy();
      view.destroy();
    };
  }, []);

  /** 🔄 Atualiza URLs dinamicamente */
  useEffect(() => {
    if (leftLayerRef.current && currentLeft) {
      leftLayerRef.current.urlTemplate = currentLeft;
      leftLayerRef.current.refresh();
    }
  }, [currentLeft]);

  useEffect(() => {
    if (rightLayerRef.current && currentRight) {
      rightLayerRef.current.urlTemplate = currentRight;
      rightLayerRef.current.refresh();
    }
  }, [currentRight]);

  const handleMosaicApply = (side: "left" | "right", mosaic: any) => {
    if (!mosaic?.id) return;
    const url = buildPlanetTileUrl(mosaic.id);

    let formatted = mosaic.when || mosaic.label || "Sem data";
    const match = String(formatted).match(/(\d{4})[-_/\.](\d{2})/);
    if (match) formatted = `${match[2]}/${match[1]}`;

    if (side === "left") {
      setCurrentLeft(url);
      setLabelLeft(formatted);
      if (mosaic.year && mosaic.month) {
        setSelectedLeft({ year: mosaic.year, month: mosaic.month });
      }
    } else {
      setCurrentRight(url);
      setLabelRight(formatted);
      if (mosaic.year && mosaic.month) {
        setSelectedRight({ year: mosaic.year, month: mosaic.month });
      }
    }

    onMosaicChange?.(side, mosaic.id);
  };

  /* --------------------------------------------
     Renderização
  --------------------------------------------- */
  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      {/* 🗺️ Mapa */}
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />

      {/* 📍 Label esquerdo (Badge) */}
      <div className="calendario-botao-esquerdo">
        <div className="calendario-botao">
          <span>{labelLeft}</span>
        </div>
      </div>

      {/* 📍 Label direito (Badge) */}
      <div className="calendario-botao-direito">
        <div className="calendario-botao">
          <span>{labelRight}</span>
        </div>
      </div>

      {/* 🛠️ Barra de ferramentas */}
      <MapToolbar showLayersBtn={true} />

      {/* Painel temporal — posicionamento independente do botão */}
      {showTemporalPanel && (
        <div>
          <TemporalLayersPanel
            mosaics={mosaics}
            droneDates={droneDates}
            image360Dates={new Set()} // Will be populated later if needed in Swipe screen
            selectedSide={selectedSidePanel}
            onSideChange={setSelectedSidePanel}
            onMosaicApply={handleMosaicApply}
            onDroneApply={onDroneDateClick}
            onClose={() => setShowTemporalPanel(false)}
          />
        </div>
      )}
    </div>
  );
}
