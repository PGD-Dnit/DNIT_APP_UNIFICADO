import { useEffect, useRef, useState } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import WebTileLayer from "@arcgis/core/layers/WebTileLayer";
import Search from "@arcgis/core/widgets/Search";
import Compass from "@arcgis/core/widgets/Compass";
import TemporalLayersPanel from "../swipe/TemporalLayersPanel";
import "./MapaInicialViewer.css";
import { buildPlanetTileUrl } from "../../core/mosaicUtils";
import { useAppStore } from "../../core/store";
import MapToolbar from "../../components/MapToolbar";

interface Props {
    tileUrl: string;
    title?: string;
    mosaics?: any[];
    initialViewpoint?: __esri.Viewpoint;
    droneDates?: Set<string>;
    onDroneDateClick?: (dayKey: string) => void;
    onMosaicChange?: (mosaicId: string) => void;
    onViewReady?: (view: __esri.MapView) => void;
}

export default function MapaInicialViewer({
    tileUrl,
    title = "Mosaico Atual",
    mosaics = [],
    initialViewpoint,
    droneDates,
    onDroneDateClick,
    onMosaicChange,
    onViewReady,
}: Props) {
    const mapDiv = useRef<HTMLDivElement>(null);
    const viewRef = useRef<MapView | null>(null);
    const tileLayerRef = useRef<WebTileLayer | null>(null);

    // Painel temporal — estado no store para persistir entre trocas de modo
    const showTemporalPanel = useAppStore((s) => s.showTemporalPanel);
    const setShowTemporalPanel = useAppStore((s) => s.setShowTemporalPanel);
    const [currentTileUrl, setCurrentTileUrl] = useState(tileUrl);
    const [label, setLabel] = useState(title);

    /** Inicializa mapa uma única vez */
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

        const searchWidget = new Search({
            view,
            includeDefaultSources: true,
            locationEnabled: true,
            popupEnabled: true,
            resultGraphicEnabled: true,
        });
        view.ui.add(searchWidget, { position: "top-right", index: 0 });

        const compass = new Compass({ view });
        view.ui.add(compass, "top-right");

        const tileLayer = new WebTileLayer({
            urlTemplate: currentTileUrl || "",
            title: "Mosaico Ativo",
            visible: !!currentTileUrl,
        });

        tileLayerRef.current = tileLayer;
        map.add(tileLayer, 0);

        const zoom = view.ui.find("zoom");
        if (zoom) {
            const container = (zoom as any).container as HTMLElement;
            Object.assign(container.style, { borderRadius: "10%", overflow: "hidden" });
        }

        view.when(() => {
            if (initialViewpoint && initialViewpoint.rotation) {
                view.rotation = initialViewpoint.rotation;
            }
            if (onViewReady) onViewReady(view);
        });

        return () => {
            try { tileLayer.destroy(); } catch { }
            try { view.destroy(); } catch { }
            viewRef.current = null;
            tileLayerRef.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (tileLayerRef.current && currentTileUrl) {
            tileLayerRef.current.urlTemplate = currentTileUrl;
            tileLayerRef.current.refresh();
        }
    }, [currentTileUrl]);

    useEffect(() => {
        setCurrentTileUrl(tileUrl);
    }, [tileUrl]);

    const handleMosaicApply = (_side: "left" | "right", mosaic: any) => {
        if (!mosaic?.id) return;
        const url = buildPlanetTileUrl(mosaic.id);

        let formatted = mosaic.when || mosaic.label || "Sem data";
        const match3 = String(formatted).match(/(\d{4})[-_/\.](\d{2})[-_/\.](\d{2})/);
        const match2 = String(formatted).match(/(\d{4})[-_/\.](\d{2})/);

        if (match3) {
            formatted = `${match3[3]}/${match3[2]}/${match3[1]}`;
        } else if (match2) {
            const y = parseInt(match2[1], 10);
            const mo = parseInt(match2[2], 10);
            const endD = String(new Date(y, mo, 0).getDate()).padStart(2, "0");
            formatted = `${endD}/${match2[2]}/${match2[1]}`;
        }

        setCurrentTileUrl(url);
        setLabel(formatted);
        onMosaicChange?.(mosaic.id);
    };

    const handleDroneApply = (_side: "left" | "right", dayKey: string) => {
        onDroneDateClick?.(dayKey);
    };

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <div ref={mapDiv} style={{ width: "100%", height: "100%" }} />

            {/* Badge da data do mosaic */}
            <div className="mapa-inicial-badge">
                <div className="mapa-inicial-badge-inner">
                    <span>{label}</span>
                </div>
            </div>

            {/* 🛠️ Barra de ferramentas (sem botão de camadas neste viewer) */}
            <MapToolbar showLayersBtn={false} />

            {/* Painel temporal */}
            {showTemporalPanel && (
                <div>
                    <TemporalLayersPanel
                        mosaics={mosaics}
                        droneDates={droneDates}
                        image360Dates={new Set()}
                        selectedSide="left"
                        hideSideSelector={true}
                        onMosaicApply={handleMosaicApply}
                        onDroneApply={handleDroneApply}
                        onClose={() => setShowTemporalPanel(false)}
                    />
                </div>
            )}
        </div>
    );
}
