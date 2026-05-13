// src/modules/imagem_obra/SetupImageOnView.ts
import type MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Handles from "@arcgis/core/core/Handles";
import { useAppStore } from "../../core/store";
import {
    safeNum,
    toEpochMs,
    ensureLayer0,
    fetchPointLayers,
    extractExposureGraphics,
    buildExposureMap,
    sortCandidatesDesc,
} from "./imageObraUtils";

function makeMsgId() {
    return `cmp_img:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

export function SetupImageOnView(view: MapView) {
    const handles = new Handles();

    // layers carregadas automaticamente (todas do /point-layer)
    let imgLayers: FeatureLayer[] = [];
    const created: FeatureLayer[] = [];
    let disposed = false;
    let initDone = false;
    let initPromise: Promise<void> | null = null;
    let unsubscribeStore: (() => void) | null = null;

    async function ensureLayersLoaded() {
        if (initDone) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            const items = await fetchPointLayers();
            if (disposed) return;

            const defs = (items || [])
                .filter((it) => it?.serviceUrl)
                // se quiser garantir public mesmo quando backend vacila:
                .filter((it) => String(it.access || "").toLowerCase() === "public")
                .map((it) => ({
                    id: it.id,
                    title: it.title ?? "Imagem da Obra",
                    url0: ensureLayer0(String(it.serviceUrl)),
                }));

            for (const def of defs) {
                const id = `io:${def.id}`;
                if (!view.map) continue;
                const existing = view.map.findLayerById(id) as FeatureLayer | null;

                if (existing) {
                    imgLayers.push(existing);
                    continue;
                }

                const layer = new FeatureLayer({
                    url: def.url0,      // ✅ SEMPRE /0
                    id,
                    title: def.title,
                    outFields: ["*"],
                });

                view.map?.add(layer);
                created.push(layer);
                imgLayers.push(layer);

                // não bloquear inicialização se alguma falhar
                layer.load().catch((e) => {
                    console.warn(`[SetupImage] layer load falhou: ${def.title}`, e);
                });
            }

            initDone = true;

            // Fetch dates for calendar
            const fetchDates = async () => {
                if (disposed) return;
                const datesSet = new Set<string>();
                await Promise.all(imgLayers.map(async (lyr) => {
                    try {
                        await lyr.load();
                        const query = lyr.createQuery();
                        query.outFields = ["*"];
                        query.where = "1=1";
                        query.returnGeometry = false;
                        const result = await lyr.queryFeatures(query);
                        result.features.forEach(f => {
                            const dateVal = f.attributes?.acquisitiondate ?? f.attributes?.acquisitionDate ?? f.attributes?.AcquisitionDate;
                            const ms = toEpochMs(dateVal);
                            if (ms) {
                                const d = new Date(ms);
                                datesSet.add(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`);
                            }
                        });
                    } catch (e) {
                        console.warn("[SetupImage] falha ao buscar datas de", lyr.title);
                    }
                }));
                if (!disposed) {
                    useAppStore.getState().setImageObraAvailableDates(datesSet);
                }
            };
            fetchDates();

            const applyFilter = async (filter: { start: number | null, end: number | null }) => {
                if (disposed) return;
                
                // Ensure layers are loaded so we can inspect layer.fields
                await Promise.all(imgLayers.map(lyr => lyr.load()));
                if (disposed) return;

                imgLayers.forEach(layer => {
                    const fieldObj = layer.fields?.find(f => f.name.toLowerCase() === "acquisitiondate");
                    const fieldName = fieldObj ? fieldObj.name : "acquisitionDate"; // fallback

                    let expr = "1=1";
                    if (filter.start || filter.end) {
                        const conditions = [];
                        
                        const formatTimestamp = (ms: number) => {
                            const d = new Date(ms);
                            const y = d.getUTCFullYear();
                            const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
                            const day = String(d.getUTCDate()).padStart(2, '0');
                            const h = String(d.getUTCHours()).padStart(2, '0');
                            const m = String(d.getUTCMinutes()).padStart(2, '0');
                            const s = String(d.getUTCSeconds()).padStart(2, '0');
                            return `TIMESTAMP '${y}-${mo}-${day} ${h}:${m}:${s}'`;
                        };

                        if (filter.start) conditions.push(`${fieldName} >= ${formatTimestamp(filter.start)}`);
                        if (filter.end) conditions.push(`${fieldName} <= ${formatTimestamp(filter.end)}`);
                        expr = conditions.join(" AND ");
                    }
                    layer.definitionExpression = expr;
                });
            };

            // Apply immediately
            applyFilter(useAppStore.getState().imageObraDateFilter);

            // Subscribe to future changes
            let lastFilter = useAppStore.getState().imageObraDateFilter;
            unsubscribeStore = useAppStore.subscribe((state) => {
                const newFilter = state.imageObraDateFilter;
                if (newFilter.start !== lastFilter.start || newFilter.end !== lastFilter.end) {
                    lastFilter = newFilter;
                    applyFilter(newFilter);
                }
            });
        })();

        return initPromise;
    }

    // carrega assim que entra no módulo
    ensureLayersLoaded().catch((e) => console.warn("[SetupImage] init error:", e));

    handles.add(
        view.on("click", async (ev) => {
            const {
                setLastClickedPoint,
                setCandidateImages,
                setSelectedImageLeft,
                setSelectedImageRight,
            } = useAppStore.getState();

            if (!ev.mapPoint) return;

            const lastClickedPoint = {
                x: ev.mapPoint.x,
                y: ev.mapPoint.y,
                wkid: ev.mapPoint.spatialReference?.wkid,
            };
            setLastClickedPoint(lastClickedPoint);

            await ensureLayersLoaded();
            if (!imgLayers.length) return;

            // ✅ hitTest em TODAS as camadas io (image_obra) carregadas
            const hit = await view.hitTest(ev, { include: imgLayers });

            const graphics = extractExposureGraphics(hit.results, "io:");

            if (!graphics.length) {
                setCandidateImages([]);
                setSelectedImageLeft(null);
                setSelectedImageRight(null);
                // Notifica a UI do mapa que não há imagem neste ponto
                useAppStore.getState().setImageObraMapMsg("Nenhuma imagem de obra encontrada neste ponto");
                setTimeout(() => useAppStore.getState().setImageObraMapMsg(null), 3500);
                return;
            }

            // ✅ junta tudo (inclusive sobrepostos), dedupe por (layerUrl+oid)
            const uniq = buildExposureMap(graphics);
            const candidates = sortCandidatesDesc(Array.from(uniq.values()));

            setCandidateImages(candidates);

            const first = candidates[0] ?? null;
            setSelectedImageLeft(first);
            setSelectedImageRight(first);

            // ======== NOVA ABA ========
            const msgId = makeMsgId();
            const base = window.location.origin;

            const url = `${base}/view-image?mid=${encodeURIComponent(msgId)}`;
            const win = window.open(url, "_blank");

            if (!win) {
                console.warn("[SetupImage] popup bloqueado pelo navegador.");
                return;
            }

            const payload = {
                __type: "DNIT_IMAGE_COMPARE_INIT",
                msgId,
                lastClickedPoint,
                candidates,
                left: first,
                right: first,
            };

            const targetOrigin = base;
            const MAX_MS = 15_000;   // 15s — cobre dev build lento
            const INTERVAL_MS = 200; // 200ms entre tentativas
            const maxAttempts = MAX_MS / INTERVAL_MS; // 75 tentativas
            let attempts = 0;

            const ackHandler = (e: MessageEvent) => {
                if (e.origin !== targetOrigin) return;
                const data: any = e.data;
                if (data?.__type === "DNIT_IMAGE_COMPARE_ACK" && data?.msgId === msgId) {
                    window.clearInterval(timer);
                    window.removeEventListener("message", ackHandler); // cleanup no sucesso
                }
            };
            window.addEventListener("message", ackHandler);

            const timer = window.setInterval(() => {
                attempts++;
                try {
                    win.postMessage(payload, targetOrigin);
                } catch { }
                if (attempts >= maxAttempts) {
                    window.clearInterval(timer);
                    window.removeEventListener("message", ackHandler); // cleanup no timeout
                }
            }, INTERVAL_MS);
        })
    );

    return () => {
        disposed = true;
        if (unsubscribeStore) {
            unsubscribeStore();
            unsubscribeStore = null;
        }

        // remove só as layers criadas por este setup (não remove se já existiam)
        for (const lyr of created) {
            try {
                view.map?.remove(lyr);
                lyr.destroy?.();
            } catch { }
        }

        handles.removeAll();
        handles.destroy();
    };
}
