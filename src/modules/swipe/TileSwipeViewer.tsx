import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Swipe from "@arcgis/core/widgets/Swipe";
// import "@arcgis/core/assets/esri/themes/light/main.css";
import MosaicCalendar from "./MosaicCalendar";
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";
import "./TileSwipeViewer.css";
import { CONFIG } from "../../core/config";

interface Props {
  leftTileUrl: string;
  rightTileUrl: string;
  titleLeft?: string;
  titleRight?: string;
  mosaics?: any[];
  initialViewpoint?: __esri.Viewpoint;
  onViewReady?: (view: __esri.MapView) => void;
}

export default function TileSwipeViewer({
  leftTileUrl,
  rightTileUrl,
  titleLeft = "Mosaico Esquerdo",
  titleRight = "Mosaico Direito",
  mosaics = [],
  initialViewpoint,
  onViewReady,
}: Props) {
  const mapDiv = useRef<HTMLDivElement>(null);
  const viewRef = useRef<MapView | null>(null);
  const leftLayerRef = useRef<WebTileLayer | null>(null);
  const rightLayerRef = useRef<WebTileLayer | null>(null);

  // 🗓️ Estados de exibição dos calendários
  const [showLeftCalendar, setShowLeftCalendar] = useState(false);
  const [showRightCalendar, setShowRightCalendar] = useState(false);

  // 🌍 URLs ativas das camadas
  const [currentLeft, setCurrentLeft] = useState(leftTileUrl);
  const [currentRight, setCurrentRight] = useState(rightTileUrl);

  // 🏷️ Labels exibidos nos painéis flutuantes
  const [labelLeft, setLabelLeft] = useState(titleLeft);
  const [labelRight, setLabelRight] = useState(titleRight);

  // 📆 Seleção persistente de mês/ano
  const [selectedLeft, setSelectedLeft] = useState<{ year: number; month: number } | null>(null);
  const [selectedRight, setSelectedRight] = useState<{ year: number; month: number } | null>(null);

  // 🔄 Sincroniza props -> estado interno
  useEffect(() => {
    setCurrentLeft(leftTileUrl);
  }, [leftTileUrl]);

  useEffect(() => {
    setCurrentRight(rightTileUrl);
  }, [rightTileUrl]);

  useEffect(() => {
    setLabelLeft(titleLeft);
  }, [titleLeft]);

  useEffect(() => {
    setLabelRight(titleRight);
  }, [titleRight]);

  /** 🔧 Inicializa mapa e Swipe */
  useEffect(() => {
    if (!mapDiv.current) return;

    const map = new Map({ basemap: "hybrid" });

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
        },
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

    // 🗺️ Camadas iniciais
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

    view.when(() => {
      if (initialViewpoint?.rotation) {
        view.rotation = initialViewpoint.rotation;
      }
      onViewReady?.(view);
    });

    return () => {
      swipe.destroy();
      view.destroy();
      viewRef.current = null;
      leftLayerRef.current = null;
      rightLayerRef.current = null;
    };
  }, []);

  /** 🔄 Atualiza URLs dinamicamente */
  useEffect(() => {
    if (leftLayerRef.current && currentLeft) {
      leftLayerRef.current.urlTemplate = currentLeft;
      leftLayerRef.current.visible = true;
      leftLayerRef.current.refresh();
    }
  }, [currentLeft]);

  useEffect(() => {
    if (rightLayerRef.current && currentRight) {
      rightLayerRef.current.urlTemplate = currentRight;
      rightLayerRef.current.visible = true;
      rightLayerRef.current.refresh();
    }
  }, [currentRight]);

  /** 📅 Seleção de mosaico esquerdo */
  const handleSelectLeft = (mosaic: any) => {
    if (!mosaic?.id) return;

    setCurrentLeft(
      `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaic.id}`
    );

    let formatted = mosaic.when || mosaic.label || "Sem data";
    const match = String(formatted).match(/(\d{4})[-_/\.](\d{2})/);
    if (match) formatted = `${match[2]}/${match[1]}`;

    setLabelLeft(formatted);

    if (mosaic.year && mosaic.month) {
      setSelectedLeft({ year: mosaic.year, month: mosaic.month });
    }

    setShowLeftCalendar(false);
  };

  /** 📅 Seleção de mosaico direito */
  const handleSelectRight = (mosaic: any) => {
    if (!mosaic?.id) return;

    setCurrentRight(
      `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaic.id}`
    );

    let formatted = mosaic.when || mosaic.label || "Sem data";
    const match = String(formatted).match(/(\d{4})[-_/\.](\d{2})/);
    if (match) formatted = `${match[2]}/${match[1]}`;

    setLabelRight(formatted);

    if (mosaic.year && mosaic.month) {
      setSelectedRight({ year: mosaic.year, month: mosaic.month });
    }

    setShowRightCalendar(false);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />

      <div className="calendario-botao-esquerdo">
        <button
          onClick={() => {
            setShowLeftCalendar(!showLeftCalendar);
            setShowRightCalendar(false);
          }}
          title="Abrir calendário esquerdo"
        >
          🗓️
        </button>
        <span>{labelLeft}</span>
      </div>

      <div className="calendario-botao-direito">
        <button
          onClick={() => {
            setShowRightCalendar(!showRightCalendar);
            setShowLeftCalendar(false);
          }}
          title="Abrir calendário direito"
        >
          🗓️
        </button>
        <span>{labelRight}</span>
      </div>

      {showLeftCalendar && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: "20%",
            background: "var(--panel, #fff)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 3000,
            width: "180px",
            minWidth: "180px",
          }}
        >
          <MosaicCalendar
            mosaics={mosaics}
            title="Mosaico Esquerdo"
            align="left"
            selected={selectedLeft}
            onChangeSelected={setSelectedLeft}
            onSelect={handleSelectLeft}
          />
        </div>
      )}

      {showRightCalendar && (
        <div
          style={{
            position: "absolute",
            bottom: 90,
            left: "70%",
            background: "var(--panel, #fff)",
            borderRadius: 12,
            boxShadow: "0 4px 12px rgba(0,0,0,0.25)",
            zIndex: 3000,
            width: "180px",
            minWidth: "180px",
          }}
        >
          <MosaicCalendar
            mosaics={mosaics}
            title="Mosaico Direito"
            align="right"
            selected={selectedRight}
            onChangeSelected={setSelectedRight}
            onSelect={handleSelectRight}
          />
        </div>
      )}
    </div>
  );
}