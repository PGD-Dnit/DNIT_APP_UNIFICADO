// src/modules/map/setupObraClickOnView.ts
import type MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Handles from "@arcgis/core/core/Handles";
import { useAppStore } from "../../core/store";
import { apiRequest } from "../../core/apiClient";

type FeatureObraItem = {
  id: string;
  title?: string;
  name?: string;
  access?: string;
  featureUrl?: string | null;
  serviceUrl?: string | null;
  url?: string | null;
};

function ensureLayer0(url: string | null | undefined): string {
  const u = (url || "").replace(/\/+$/, "");
  if (u.endsWith("/0")) return u;
  if (u.endsWith("/FeatureServer")) return `${u}/0`;
  if (/\/FeatureServer\/\d+$/.test(u)) return u;
  return u;
}

async function fetchFeaturesObras(): Promise<FeatureObraItem[]> {
  const data = await apiRequest<FeatureObraItem[]>("/features-obras");
  return Array.isArray(data) ? data : [];
}

/**
 * Carrega automaticamente as camadas de Obras vindas de GET /features-obras (prefixo fo:<id>)
 * e escuta cliques no MapView para abrir os detalhes via /features-obras/consultaObra
 */
export function setupObraClickOnView(view: MapView): () => void {
  const handles = new Handles();
  const foLayers: FeatureLayer[] = [];
  const created: FeatureLayer[] = [];
  let disposed = false;
  let initDone = false;
  let initPromise: Promise<void> | null = null;

  async function ensureLayersLoaded() {
    if (initDone) return;
    if (initPromise) return initPromise;

    initPromise = (async () => {
      const items = await fetchFeaturesObras();
      if (disposed) return;

      const defs = (items || [])
        .map((it) => {
          const rawUrl = it?.featureUrl || it?.serviceUrl || it?.url;
          return {
            id: it.id,
            title: it.title ?? it.name ?? "Obras",
            access: it.access,
            url0: rawUrl ? ensureLayer0(String(rawUrl)) : "",
          };
        })
        .filter((d) => !!d.url0);

      for (const def of defs) {
        const id = `fo:${def.id}`;
        if (!view.map) continue;

        const existing = view.map.findLayerById(id) as FeatureLayer | null;
        if (existing) {
          foLayers.push(existing);
          continue;
        }

        const layer = new FeatureLayer({
          url: def.url0,
          id,
          title: def.title,
          outFields: ["*"],
          minScale: 0,
          maxScale: 0,
        });

        view.map.add(layer, 9999);
        created.push(layer);
        foLayers.push(layer);

        layer.load().catch((e) => {
          console.warn(`[ObraClick] layer load falhou: ${def.title}`, e);
        });
      }

      initDone = true;
    })();

    return initPromise;
  }

  ensureLayersLoaded().catch((e) => console.warn("[ObraClick] init error:", e));

  handles.add(
    view.on("click", async (ev) => {
      if (!ev.mapPoint) return;

      try {
        await ensureLayersLoaded();
        if (disposed || !foLayers.length) return;

        // hitTest restrito às camadas carregadas de /features-obras (fo:*)
        const hit = await view.hitTest(ev, { include: foLayers });
        if (!hit.results || !hit.results.length) return;

        for (const res of hit.results) {
          if (res.type !== "graphic" || !res.graphic) continue;

          const graphic = res.graphic;
          const attrs = graphic.attributes || {};
          const layer = graphic.layer as any;
          const layerId = String(layer?.id || "");

          if (!layerId.startsWith("fo:")) continue;

          // Busca o campo globalid em diferentes variações de casing
          const globalIdVal =
            attrs.globalid ??
            attrs.GlobalId ??
            attrs.GLOBALID ??
            attrs.global_id ??
            attrs.Global_ID;

          if (!globalIdVal) continue;

          const idFinal = layerId.slice(3) || layer?.portalItem?.id || "";
          const globalIdFinal = String(globalIdVal);

          console.log(
            `[arcgis] Obra selecionada | featureId=${idFinal} | globalId=${globalIdFinal}`
          );

          const targetUrl = `${window.location.origin}/detalhes-obra?id=${encodeURIComponent(
            idFinal
          )}&globalid=${encodeURIComponent(globalIdFinal)}`;

          const globalWin = window as any;
          if (globalWin.currentClickContext?.win && !globalWin.currentClickContext.win.closed) {
            const ctx = globalWin.currentClickContext;
            ctx.type = "obra_detalhes";
            ctx.hit360 = true;
            ctx.hitObra = true;
            ctx.checked360 = true;
            ctx.checkedObra = true;
            ctx.win.location.href = targetUrl;
          } else {
            const opened = window.open(targetUrl, "_blank");
            if (!opened) {
              // Fallback para modal local apenas se o navegador bloquear a abertura de aba
              useAppStore.getState().setSelectedObraQuery({
                id: idFinal,
                globalid: globalIdFinal,
              });
            }
          }

          break;
        }
      } catch (err) {
        console.warn("[ObraClick] Erro no hitTest:", err);
      }
    })
  );

  return () => {
    disposed = true;
    for (const lyr of created) {
      try {
        view.map?.remove(lyr);
        lyr.destroy?.();
      } catch {
        /* ignore */
      }
    }
    handles.removeAll();
    handles.destroy();
  };
}
