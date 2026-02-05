import React, { useEffect, useRef } from "react";
import Map from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import type Graphic from "@arcgis/core/Graphic";

import { useAppStore } from "../../core/store1";
import { CONFIG } from "../../core/config";

export default function Imagem360View() {
  const divRef = useRef<HTMLDivElement | null>(null);

  const exposureLayerUrl = useAppStore((s) => s.activeExposureLayerUrl);
  const setSelectedLocation = useAppStore((s) => s.setSelectedLocation);
  const setSelectedExposure = useAppStore((s) => s.setSelectedExposure);
  const setLastClickedPoint = useAppStore((s) => s.setLastClickedPoint);

  useEffect(() => {
    if (!divRef.current) return;

    let view: MapView | null = null;

    let exposureLayer: FeatureLayer | null = null;

    const map = new Map({ basemap: CONFIG.BASEMAP as any });

    view = new MapView({
      container: divRef.current,
      map,
      center: [-47.8825, -15.7942],
      zoom: 5,
    });


    // camada de exposure points (clicável)
    if (exposureLayerUrl) {
      exposureLayer = new FeatureLayer({
        url: exposureLayerUrl,
        outFields: ["*"],
        title: "Exposure Points",
      });
      map.add(exposureLayer);
    }

    // helper: aplicar highlight via FeatureEffect
    const applyHighlight = (oid: number | null) => {
      if (!exposureLayer) return;

      if (!oid) {
        exposureLayer.featureEffect = null;
        return;
      }

      // OBJECTID é o padrão de OID; se a sua camada usa outro, ajuste.
      exposureLayer.featureEffect = new FeatureEffect({
        filter: { where: `OBJECTID = ${oid}` },
        includedEffect: "drop-shadow(2px, 2px, 3px, rgba(0,0,0,0.7)) brightness(1.25)",
        excludedEffect: "opacity(25%) grayscale(80%)",
      });
    };

    let clickHandle: __esri.Handle | null = null;

    // CLICK
    clickHandle = view.on("click", async (event) => {
      if (!view) return;

      const mp = view.toMap(event);
      if (mp) {
        setLastClickedPoint({
          x: mp.x,
          y: mp.y,
          wkid: mp.spatialReference?.wkid ?? undefined, // ✅ evita null
        });
      }

      const p = view.toMap(event);
      if (p) {
        setSelectedLocation({ x: p.x, y: p.y, wkid: p.spatialReference?.wkid });
      }

      if (!exposureLayer || !exposureLayerUrl) {
        setSelectedExposure(null);
        applyHighlight(null);
        return;
      }

      const hit = await view.hitTest(event);

      // ✅ pega diretamente o hit da exposureLayer
      const exposureHit = hit.results.find((r) => {
        const gh = r as __esri.MapViewGraphicHit;
        if (!gh.graphic) return false;

        const layer = gh.graphic.layer as any;

        const sameInstance = layer === exposureLayer;
        const sameUrl =
          layer?.url &&
          String(layer.url).replace(/\/+$/, "") === String(exposureLayerUrl).replace(/\/+$/, "");

        return sameInstance || sameUrl;
      }) as __esri.MapViewGraphicHit | undefined;

      const g: Graphic | undefined = exposureHit?.graphic;

      if (!g) {
        setSelectedExposure(null);
        applyHighlight(null);
        return;
      }

      const oid =
        g.attributes?.OBJECTID ??
        g.attributes?.objectid ??
        g.attributes?.ObjectId;

      if (!oid) {
        setSelectedExposure(null);
        applyHighlight(null);
        return;
      }

      const oidNum = Number(oid);

      setSelectedExposure({
        objectId: oidNum,
        layerUrl: exposureLayerUrl,
        title: "Exposure selecionado",
        attrs: g.attributes, // ✅ AQUI
      });


      applyHighlight(oidNum);

      try {
        await view.goTo(
          { target: g.geometry, zoom: Math.max(view.zoom ?? 16, 18) },
          { duration: 350 }
        );
      } catch { }
    });


    return () => {
      try { clickHandle?.remove(); } catch { }
      try { exposureLayer?.destroy(); } catch { }
      try { view?.destroy(); } catch { }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exposureLayerUrl]);

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
