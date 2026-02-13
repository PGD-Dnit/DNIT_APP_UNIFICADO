//import React, { useEffect, useState } from "react";
import { apiClient } from "../core/apiClient";
import { useAppStore } from "../core/store";
import type { TileSource } from "../core/types";
import { useAppStore } from "../core/store";

export default function SourcesPanel() {
  const setLeftTile = useAppStore((s) => s.setLeftTile);
  const setRightTile = useAppStore((s) => s.setRightTile);
  const setExposureUrl = useAppStore((s) => s.setActiveExposureLayerUrl);

  const [planet, setPlanet] = useState<any[]>([]);
  const [wayback, setWayback] = useState<any[]>([]);
  const [oi, setOi] = useState<any[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setErr(null);
        const [p, w, o] = await Promise.all([
          apiClient.planetMosaics("", 50),
          apiClient.wayback(50),
          apiClient.orientedImagery(50),
        ]);
        setPlanet(p);
        setWayback(w);
        setOi(o);
      } catch (e: any) {
        setErr(e.message || String(e));
      }
    })();
  }, []);

  const toTilePlanet = (m: any): TileSource => ({
    id: m.id,
    title: m.captured ? `Planet ${m.captured}` : m.title,
    tileUrl: m.tileUrl,
    kind: "planet",
    captured: m.captured,
  });

  const toTileWayback = (r: any): TileSource => ({
    id: r.id,
    title: `Wayback ${r.releaseDate}`,
    tileUrl: r.tileUrl,
    kind: "wayback",
  });

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontWeight: 800 }}>Sources</div>
      {err && <div style={{ fontSize: 12, color: "crimson" }}>{err}</div>}

      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Swipe LEFT (Planet)</div>
        <select style={{ width: "100%" }} onChange={(e) => {
          const m = planet.find((x) => x.id === e.target.value);
          setLeftTile(m ? toTilePlanet(m) : null);
        }}>
          <option value="">— selecione —</option>
          {planet.map((m) => (
            <option key={m.id} value={m.id}>{m.captured ? m.captured : m.title}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Swipe RIGHT (Wayback)</div>
        <select style={{ width: "100%" }} onChange={(e) => {
          const r = wayback.find((x) => x.id === e.target.value);
          setRightTile(r ? toTileWayback(r) : null);
        }}>
          <option value="">— selecione —</option>
          {wayback.map((r) => (
            <option key={r.id} value={r.id}>{r.releaseDate} — {r.title}</option>
          ))}
        </select>
      </div>

      <div>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>Exposure Layer (360)</div>
        <select style={{ width: "100%" }} onChange={(e) => setExposureUrl(e.target.value || null)}>
          <option value="">— selecione —</option>
          {oi.map((it) => (
            <option key={it.id} value={(it.serviceUrl || "").replace(/\/+$/, "") + "/0"}>
              {it.title}
            </option>
          ))}
        </select>
        <div style={{ fontSize: 11, opacity: 0.7, marginTop: 6 }}>
          Obs.: estou assumindo FeatureServer/0 como exposure points.
        </div>
      </div>
    </div>
  );
}
