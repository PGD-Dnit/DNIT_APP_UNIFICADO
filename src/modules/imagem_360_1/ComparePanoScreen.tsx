import React from "react";
import { useAppStore } from "../../core/store1";
import DualPanoViewer from "./DualPanoViewer";

export default function ComparePanoScreen() {
  const pano = useAppStore((s) => s.pano);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);

  if (!pano) {
    return (
      <div style={{ padding: 12 }}>
        <button onClick={() => setCompareOpen(false)}>Voltar</button>
        <div style={{ marginTop: 12 }}>Nenhuma imagem selecionada.</div>
      </div>
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        display: "grid",
        gridTemplateRows: "48px 1fr",
      }}
    >
      {/* HEADER */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "0 12px",
          borderBottom: "1px solid rgba(255,255,255,0.12)",
        }}
      >
        <button onClick={() => setCompareOpen(false)}>⬅ Voltar</button>
        <div style={{ fontWeight: 800 }}>
          Comparação 360 • OID {pano.objectId} • ATT {pano.attachmentId}
        </div>
      </div>

      {/* CONTEÚDO */}
      <div style={{ minHeight: 0, padding: 8 }}>
        {/* 🔎 DEBUG: teste simples de carregamento */}
        <img
          src={pano.url}
          style={{
            maxWidth: 320,
            marginBottom: 8,
            border: "1px solid #333",
          }}
          onError={() =>
            console.log("❌ Falha ao carregar pano.url:", pano.url)
          }
          onLoad={() =>
            console.log("✅ pano.url carregou OK:", pano.url)
          }
        />

        {/* VIEWER REAL */}
        <DualPanoViewer
          leftUrl={pano.url}
          rightUrl={pano.url}
          leftHeading={pano.cameraHeading ?? null}
          leftPitch={pano.cameraPitch ?? null}
          leftVfov={pano.vfov ?? null}
          rightHeading={pano.cameraHeading ?? null}
          rightPitch={pano.cameraPitch ?? null}
          rightVfov={pano.vfov ?? null}
        />
      </div>
    </div>
  );

}
