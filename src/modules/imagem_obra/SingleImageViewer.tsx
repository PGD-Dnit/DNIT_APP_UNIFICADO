// src/modules/imagem_obra/SingleImageViewer.tsx
import ZoomViewer from "../../components/ZoomViewer";

export default function SingleImageViewer({ url }: { url: string }) {
  return (
    <div style={{ width: "100%", height: "100%", backgroundColor: "#000", overflow: "hidden" }}>
      <ZoomViewer url={url} />
    </div>
  );
}
