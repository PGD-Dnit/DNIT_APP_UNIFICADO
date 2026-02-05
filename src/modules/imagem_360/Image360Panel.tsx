import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../core/store";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";

type Att = { id: number; name?: string; contentType?: string; size?: number };

function pickBest(atts: Att[]) {
  const imgs = atts.filter((a) => (a.contentType || "").startsWith("image/"));
  const base = imgs.length ? imgs : atts;
  if (!base.length) return null;
  return base.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0];
}

export default function Image360Panel() {
  const exposureLeft = useAppStore((s) => s.selectedExposureLeft);
  const exposureRight = useAppStore((s) => s.selectedExposureRight);

  const exposure = exposureLeft ?? exposureRight;

  const exposureKey = useMemo(() => {
    return exposure ? `${exposure.layerUrl}::${exposure.objectId}` : "";
  }, [exposure?.layerUrl, exposure?.objectId]);

  const [atts, setAtts] = useState<Att[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!exposure) {
      setAtts([]);
      setLoading(false);
      setErr(null);
      return;
    }

    let alive = true;
    setLoading(true);
    setErr(null);

    (async () => {
      try {
        if (!exposure.layerUrl || !exposure.objectId) {
          throw new Error("Exposure inválida: layerUrl/objectId ausentes.");
        }

        const a = await listAttachments(exposure.layerUrl, exposure.objectId);
        if (!alive) return;

        setAtts(a || []);
      } catch (e: any) {
        if (!alive) return;
        setErr(e?.message || "Erro ao carregar anexos.");
      } finally {
        if (!alive) return;
        setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [exposureKey]);

  if (!exposure) {
    return (
      <div style={{ padding: 12 }}>
        <div style={{ fontWeight: 700, marginBottom: 8 }}>Imagem 360</div>
        <div style={{ opacity: 0.8 }}>
          Clique em um ponto no mapa para carregar a imagem.
        </div>
      </div>
    );
  }

  const best = pickBest(atts);

  return (
    <div style={{ padding: 12, height: "100%", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 700 }}>Imagem 360</div>

      <div style={{ fontSize: 12, opacity: 0.85 }}>
        OBJECTID: {exposure.objectId}
      </div>

      {loading && <div>Carregando anexos…</div>}
      {err && <div style={{ color: "#ffb4b4" }}>{err}</div>}

      {!loading && !err && !best && (
        <div style={{ opacity: 0.85 }}>Nenhum anexo encontrado para este ponto.</div>
      )}

      {!loading && !err && best && (
        <img
          src={buildAttachmentUrl(exposure.layerUrl, exposure.objectId, best.id)}
          style={{ width: "100%", borderRadius: 12, objectFit: "cover" }}
          alt={best.name || "Imagem 360"}
        />
      )}
    </div>
  );
}
