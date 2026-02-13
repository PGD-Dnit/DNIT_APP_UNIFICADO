import React, { useEffect, useRef } from "react";
import WebMap from "@arcgis/core/WebMap";
import MapView from "@arcgis/core/views/MapView";
//import "@arcgis/core/assets/esri/themes/light/main.css";

interface Props {
  itemId: string;
}

const WebMapViewer: React.FC<Props> = ({ itemId }) => {
  const mapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mapRef.current) return;

    const webmap = new WebMap({
      portalItem: {
        id: itemId,
        portal: {
          url: "https://sig.dnit.gov.br/portal",
        },
      },
    });

    const view = new MapView({
      container: mapRef.current,
      map: webmap,
    });

    return () => {
      view.destroy();
    };
  }, [itemId]);

  return <div ref={mapRef} style={{ height: "1000px", marginTop: "20px" }} />;
};

export default WebMapViewer;
