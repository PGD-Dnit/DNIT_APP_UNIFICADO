//
import HomeMap from "../modules/map/MapBase";

export default function Home() {
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "1fr" }}>
      <HomeMap />
    </div>
  );
}
