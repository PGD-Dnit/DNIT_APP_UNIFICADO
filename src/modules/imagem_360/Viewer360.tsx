//import React from "react";
import { useAppStore } from "../../core/store";
import DualPanoViewer from "./DualPanoViewer"; // ajuste o path se necessário

export default function Viewer360() {
  const pano = useAppStore((s) => s.pano);

  if (!pano) {
    return (
      <div style={{ fontSize: 12, opacity: 0.6, padding: 8 }}>
        Nenhuma imagem 360 selecionada.
      </div>
    );
  }

  return (
    <DualPanoViewer src={pano.url} />
  );
}
