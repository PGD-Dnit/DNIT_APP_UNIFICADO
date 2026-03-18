//import React from "react";
import { useAppStore } from "../../core/store";
import DualPanoViewer from "./DualPanoViewer"; // ajuste o path se necessário

export default function Viewer360() {
  const panoLeft = useAppStore((s) => s.panoLeft);
  const panoRight = useAppStore((s) => s.panoRight);

  if (!panoLeft && !panoRight) {
    return (
      <div style={{ fontSize: 12, opacity: 0.6, padding: 8 }}>
        Nenhuma imagem 360 selecionada.
      </div>
    );
  }

  return (
    <DualPanoViewer
      leftUrl={panoLeft?.url ?? ""}
      rightUrl={panoRight?.url ?? ""}
      leftHeading={panoLeft?.cameraHeading ?? null}
      leftPitch={panoLeft?.cameraPitch ?? null}
      leftVfov={panoLeft?.vfov ?? null}
      rightHeading={panoRight?.cameraHeading ?? null}
      rightPitch={panoRight?.cameraPitch ?? null}
      rightVfov={panoRight?.vfov ?? null}
    />
  );
}
