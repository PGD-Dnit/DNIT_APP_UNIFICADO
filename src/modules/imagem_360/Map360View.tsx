import React, { useEffect, useRef } from "react";
import EsriMap from "@arcgis/core/Map";
import MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import FeatureEffect from "@arcgis/core/layers/support/FeatureEffect";
import type { ExposureRef } from "../../core/types";

import { useAppStore } from "../../core/store";
import { CONFIG } from "../../core/config";

export default function Map360View() {
  const divRef = useRef<HTMLDivElement | null>(null);

  const setCandidateExposures = useAppStore((s) => s.setCandidateExposures);
  const setSelectedExposureLeft = useAppStore((s) => s.setSelectedExposureLeft);
  const setSelectedExposureRight = useAppStore((s) => s.setSelectedExposureRight);
  const setCompareOpen = useAppStore((s) => s.setCompareOpen);
  const setLastClickedPoint = useAppStore((s) => s.setLastClickedPoint);

  useEffect(() => {
    if (!divRef.current) return;

    const layerUrl = CONFIG.IMAGENS360_LAYER_URL; // já com /0
    const map = new EsriMap({ basemap: CONFIG.BASEMAP as any });

    const exposureLayer = new FeatureLayer({
      url: layerUrl,
      outFields: ["*"],
      title: "Exposure Points",
    });
    map.add(exposureLayer);

    const view = new MapView({
      container: divRef.current,
      map,
      center: [-47.8825, -15.7942],
      zoom: 11,
    });

    const applyHighlight = (oid: number | null) => {
      if (!oid) {
        exposureLayer.featureEffect = null;
        return;
      }
      exposureLayer.featureEffect = new FeatureEffect({
        filter: { where: `OBJECTID = ${oid}` },
        includedEffect:
          "drop-shadow(2px, 2px, 3px, rgba(0,0,0,0.7)) brightness(1.25)",
        excludedEffect: "opacity(25%) grayscale(80%)",
      });
    };

    const clickHandle = view.on("click", async (event) => {
      const mp = view.toMap(event);
      if (mp) {
        setLastClickedPoint({
          x: mp.x,
          y: mp.y,
          wkid: mp.spatialReference?.wkid ?? undefined,
        });
      }

      const hit = await view.hitTest(event);

      const exposureGraphics = hit.results
        .map((r) => (r as __esri.MapViewGraphicHit).graphic)
        .filter((g) => g?.layer === exposureLayer && g.attributes);

      if (exposureGraphics.length === 0) {
        setSelectedExposureLeft(null);
        setSelectedExposureRight(null);
        setCandidateExposures([]);
        applyHighlight(null);
        return;
      }

      const rawCandidates = exposureGraphics
        .map((g) => {
          const oid =
            g.attributes.OBJECTID ??
            g.attributes.objectid ??
            g.attributes.ObjectId;

          const acq =
            g.attributes.acquisitiondate ??
            g.attributes.acquisitionDate ??
            null;

          const objectId = Number(oid);
          const acquisitionDate = typeof acq === "number" ? acq : Number(acq);

          if (!Number.isFinite(objectId)) return null;

          const ref: ExposureRef = {
            objectId,
            layerUrl,
            title: "Exposure",
            attrs: {
              ...g.attributes,
              acquisitiondate: Number.isFinite(acquisitionDate)
                ? acquisitionDate
                : g.attributes?.acquisitiondate ?? null,
            },
            acquisitionDate: Number.isFinite(acquisitionDate)
              ? acquisitionDate
              : undefined,
          };

          return ref;
        })
        .filter(Boolean) as ExposureRef[];

      // remove duplicados por objectId
      const uniq = new globalThis.Map<number, ExposureRef>();
      for (const c of rawCandidates) uniq.set(c.objectId, c);
      const candidates = Array.from(uniq.values());

      // ordena por data desc
      candidates.sort((a, b) => {
        const da = Number(a.attrs?.acquisitiondate ?? 0) || 0;
        const db = Number(b.attrs?.acquisitiondate ?? 0) || 0;
        return db - da;
      });

      setCandidateExposures(candidates);

      // ✅ abre compare e começa com a MESMA imagem nos 2 lados
      const first = candidates[0] ?? null;
      setSelectedExposureLeft(first);
      setSelectedExposureRight(first);

      setCompareOpen(true);

      if (first) applyHighlight(first.objectId);

      // zoom robusto
      const bestGraphic = exposureGraphics.find((g) => {
        const oid =
          g.attributes.OBJECTID ??
          g.attributes.objectid ??
          g.attributes.ObjectId;
        return Number(oid) === first?.objectId;
      });

      try {
        const geom = bestGraphic?.geometry;
        if (geom && !view.destroyed) {
          await view.goTo(
            { center: geom, zoom: Math.max(view.zoom ?? 16, 18) },
            { duration: 350 }
          );
        }
      } catch (e) {
        console.warn("goTo falhou:", e);
      }
    });

    return () => {
      try {
        clickHandle?.remove();
      } catch { }
      try {
        view?.destroy();
      } catch { }
    };
  }, [
    setCandidateExposures,
    setSelectedExposureLeft,
    setSelectedExposureRight,
    setCompareOpen,
    setLastClickedPoint,
  ]);

  return <div ref={divRef} style={{ width: "100%", height: "100%" }} />;
}
