// src/modules/imagem_360/Image360Panel.tsx
import React, { useEffect, useMemo, useState } from "react";
import { useAppStore } from "../../core/store1";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";

type Att = { id: number; name?: string; contentType?: string; size?: number };

function pickBest(atts: Att[]) {
  const imgs = atts.filter((a) => (a.contentType || "").startsWith("image/"));
  const base = imgs.length ? imgs : atts;
  if (!base.length) return null;
  return base.slice().sort((a, b) => (b.size || 0) - (a.size || 0))[0];
}

export default function Image360Panel() {
  const exposure = useAppStore((s) => s.selectedExposure);

  // ✅ pega actions do store (NO TOPO, não dentro de effects)
  const setPano = useAppStore((s) => s.setPano);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);

  const [atts, setAtts] = useState<Att[]>([]);
  const [selectedAttId, setSelectedAttId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // URL final do attachment (ex.: .../FeatureServer/0/6/attachments/6)
  const attachmentUrl = useMemo(() => {
    if (!exposure || !selectedAttId) return null;
    return buildAttachmentUrl(exposure.layerUrl, exposure.objectId, selectedAttId);
  }, [exposure, selectedAttId]);

  // 1) Busca attachments quando muda o ponto selecionado
  useEffect(() => {
    (async () => {
      if (!exposure) {
        setAtts([]);
        setSelectedAttId(null);
        setErr(null);
        setPano(null);
        return;
      }

      try {
        setLoading(true);
        setErr(null);

        const list = await listAttachments(exposure.layerUrl, exposure.objectId);
        setAtts(list);

        const best = pickBest(list);
        setSelectedAttId(best ? best.id : null);
      } catch (e: any) {
        setErr(e.message || String(e));
        setAtts([]);
        setSelectedAttId(null);
        setPano(null);
      } finally {
        setLoading(false);
      }
    })();
  }, [exposure?.layerUrl, exposure?.objectId, setPano]);

  // 2) Sempre que URL/attachment mudar: grava no store e abre a tela de comparação
  useEffect(() => {
    if (!exposure || !attachmentUrl || !selectedAttId) {
      setPano(null);
      return;
    }

    const info = atts.find((a) => a.id === selectedAttId);

    setPano({
      objectId: exposure.objectId,
      attachmentId: selectedAttId,
      url: attachmentUrl,
      name: info?.name ?? null,
      contentType: info?.contentType ?? null,

      // ✅ metadados vindos do clique (exposure.attrs)
      cameraHeading:
        exposure.attrs?.cameraheading ?? exposure.attrs?.cameraHeading ?? null,
      cameraPitch:
        exposure.attrs?.camerapitch ?? exposure.attrs?.cameraPitch ?? null,
      cameraRoll:
        exposure.attrs?.cameraroll ?? exposure.attrs?.cameraRoll ?? null,
      vfov:
        exposure.attrs?.verticalfieldofview ?? exposure.attrs?.vfov ?? null,
    });

    // ✅ abre a “outra tela” imediatamente após selecionar
    setCompareOpen(true);
  }, [
    exposure,
    attachmentUrl,
    selectedAttId,
    atts,
    setPano,
    setCompareOpen,
  ]);

  return (
    <div style={{ padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontWeight: 800 }}>Imagem 360</div>

      {!exposure ? (
        <div style={{ fontSize: 12, opacity: 0.7 }}>
          Clique num ponto (FeatureServer/0) para carregar o attachment.
        </div>
      ) : (
        <div style={{ fontSize: 12 }}>
          Ponto selecionado: <b>OBJECTID={exposure.objectId}</b>
        </div>
      )}

      {loading && <div style={{ fontSize: 12 }}>Carregando attachments…</div>}
      {err && <div style={{ fontSize: 12, color: "crimson" }}>{err}</div>}

      {exposure && (
        <>
          <div style={{ fontSize: 12, opacity: 0.8 }}>
            Attachments encontrados: {atts.length}
          </div>

          {atts.length > 0 && (
            <select
              style={{ width: "100%" }}
              value={selectedAttId ?? ""}
              onChange={(e) => setSelectedAttId(Number(e.target.value))}
            >
              {atts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id} • {a.name || a.contentType || "arquivo"} •{" "}
                  {Math.round((a.size || 0) / 1024)} KB
                </option>
              ))}
            </select>
          )}

          {!attachmentUrl ? (
            <div style={{ fontSize: 12, opacity: 0.7 }}>
              Sem attachment para renderizar.
            </div>
          ) : (
            <>
              {/* ✅ só para confirmar visualmente. Pode remover depois */}
              <div
                style={{
                  border: "1px solid rgba(255,255,255,0.15)",
                  borderRadius: 10,
                  overflow: "hidden",
                }}
              >
                <img
                  src={attachmentUrl}
                  alt="Attachment"
                  style={{ width: "100%", display: "block" }}
                  onError={() =>
                    setErr("Falha ao carregar a imagem (CORS/permissão/token).")
                  }
                />
              </div>

              <div style={{ fontSize: 11, opacity: 0.7, wordBreak: "break-all" }}>
                URL: {attachmentUrl}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
