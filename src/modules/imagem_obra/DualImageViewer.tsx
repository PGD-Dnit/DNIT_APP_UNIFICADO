// src/modules/imagem_obra/DualImageViewer.tsx
import ZoomViewer from "../../components/ZoomViewer";

type ImgStatus = "waiting" | "loading" | "empty" | "ready";

type Props = {
  urlLeft?: string;
  urlRight?: string;
  statusLeft?: ImgStatus;
  statusRight?: ImgStatus;
};

function Placeholder({ status, side }: { status: ImgStatus; side: "esquerda" | "direita" }) {
  const outer: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
  };

  const card: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    background: "rgba(255, 255, 255, 0.91)",
    border: "1px solid rgba(220, 225, 230, 0.15)",
    borderRadius: 16,
    padding: "28px 44px",
    color: "rgba(0, 0, 0, 0.55)",
    fontSize: 13,
    backdropFilter: "blur(4px)",
    maxWidth: 280,
    textAlign: "center" as const,
  };

  if (status === "loading") {
    return (
      <div style={outer}>
        <div style={card}>
          <i className="fa-solid fa-circle-notch fa-spin" style={{ fontSize: 28, opacity: 0.5 }} />
          <span>Carregando imagem…</span>
        </div>
      </div>
    );
  }

  if (status === "empty") {
    return (
      <div style={outer}>
        <div style={card}>
          <i className="fa-solid fa-image-slash" style={{ fontSize: 28, opacity: 0.45 }} />
          <span>Sem imagem para este ponto</span>
          <span style={{ fontSize: 11, opacity: 0.6 }}>Tente outro ponto no mini-mapa</span>
        </div>
      </div>
    );
  }

  // waiting
  return (
    <div style={outer}>
      <div style={card}>
        <i className="fa-solid fa-map-location-dot" style={{ fontSize: 28, opacity: 0.4 }} />
        <span>Imagem {side}</span>
      </div>
    </div>
  );
}

export default function DualImageViewer({ urlLeft, urlRight, statusLeft = "waiting", statusRight = "waiting" }: Props) {
  return (
    <div style={{ display: "flex", width: "100%", height: "100%", backgroundColor: "#0b0f14" }}>
      {/* Lado Esquerdo */}
      <div style={{ flex: 1, borderRight: "2px solid rgba(255,255,255,0.08)", position: "relative" }}>
        {urlLeft
          ? <ZoomViewer url={urlLeft} />
          : <Placeholder status={statusLeft} side="esquerda" />
        }
      </div>

      {/* Lado Direito */}
      <div style={{ flex: 1, position: "relative" }}>
        {urlRight
          ? <ZoomViewer url={urlRight} />
          : <Placeholder status={statusRight} side="direita" />
        }
      </div>
    </div>
  );
}
