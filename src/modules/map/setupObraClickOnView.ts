// src/modules/map/setupObraClickOnView.ts
import type MapView from "@arcgis/core/views/MapView";
import Handles from "@arcgis/core/core/Handles";
import { useAppStore } from "../../core/store";

/**
 * Escuta cliques no MapView para detectar seleções de feição de Obra
 * e abrir o modal de detalhes via /features-obras/consultaObra
 */
export function setupObraClickOnView(view: MapView): () => void {
  const handles = new Handles();

  handles.add(
    view.on("click", async (ev) => {
      if (!ev.mapPoint) return;

      try {
        const hit = await view.hitTest(ev);
        if (!hit.results || !hit.results.length) return;

        for (const res of hit.results) {
          if (res.type !== "graphic" || !res.graphic) continue;

          const graphic = res.graphic;
          const attrs = graphic.attributes || {};
          const layer = graphic.layer as any;

          // ── Restrição: tags contém 'obras_acompanhamento' AND type é 'Feature Service' ──
          const layerTags: string[] = Array.isArray(layer?.portalItem?.tags)
            ? layer.portalItem.tags
            : Array.isArray(layer?.tags)
              ? layer.tags
              : Array.isArray(attrs?.tags)
                ? attrs.tags
                : typeof layer?.tags === "string"
                  ? layer.tags.split(",")
                  : typeof attrs?.tags === "string"
                    ? attrs.tags.split(",")
                    : [];

          const hasTag =
            layerTags.some(
              (tag) => String(tag).trim().toLowerCase().includes("obra")
            ) ||
            String(layer?.title || "").toLowerCase().includes("obra") ||
            String(layer?.url || "").toLowerCase().includes("obra") ||
            !!(attrs.globalid || attrs.GlobalId || attrs.GLOBALID || attrs.nome_obra || attrs.NomeObra);

          const rawType = String(
            layer?.portalItem?.type || layer?.type || layer?.tipo || attrs?.type || attrs?.tipo || ""
          ).toLowerCase();

          const isFeatureService =
            rawType.includes("feature service") ||
            rawType.includes("feature layer") ||
            rawType === "feature" ||
            String(layer?.url || "").includes("FeatureServer") ||
            String(layer?.url || "").includes("FeatureService") ||
            layer?.type === "feature";

          // Só prossegue se for uma camada/feição de obra e Feature Service
          if (!hasTag || !isFeatureService) {
            continue;
          }

          // Busca o campo globalid em diferentes variações de casing
          const globalIdVal =
            attrs.globalid ??
            attrs.GlobalId ??
            attrs.GLOBALID ??
            attrs.global_id ??
            attrs.Global_ID;

          if (!globalIdVal) continue;

          // Extrai o ID da camada / feature
          let featureId = layer?.portalItem?.id || layer?.id || "";

          // Se o id da camada for no formato "io:3ac0f727..." ou "feature-..."
          if (featureId.startsWith("io:")) {
            featureId = featureId.slice(3);
          } else if (featureId.startsWith("feature-")) {
            featureId = featureId.replace("feature-", "");
          }

          // Se layer.url existir e não tivermos um ID limpo, podemos usar layer.url
          if (!featureId && layer?.url) {
            featureId = layer.url;
          }

          const idFinal = featureId;
          const globalIdFinal = String(globalIdVal);

          console.log(
            `%c[ObraClick] 🏗️ Obra Clicada!\n ➔ ID Feature: ${idFinal}\n ➔ GlobalID: ${globalIdFinal}`,
            "color: #38bdf8; font-weight: bold; font-size: 13px;"
          );

          // URL para a nova aba com as informações da obra
          const targetUrl = `${window.location.origin}/detalhes-obra?id=${encodeURIComponent(
            idFinal
          )}&globalid=${encodeURIComponent(globalIdFinal)}`;

          // Se o Setup360 ou SetupImage abriu uma janela síncrona, redireciona essa janela para a página da obra
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
            // Caso contrário, abre diretamente em nova aba
            window.open(targetUrl, "_blank");
          }

          // Atualiza também o store para compatibilidade
          useAppStore.getState().setSelectedObraQuery({
            id: idFinal,
            globalid: globalIdFinal,
          });

          break; // Processa apenas a primeira feição encontrada
        }
      } catch (err) {
        console.warn("[ObraClick] Erro no hitTest:", err);
      }
    })
  );

  return () => {
    handles.removeAll();
    handles.destroy();
  };
}
