// src/modules/imagem_360/Setup360OnView.ts
import type MapView from "@arcgis/core/views/MapView";
import FeatureLayer from "@arcgis/core/layers/FeatureLayer";
import Handles from "@arcgis/core/core/Handles";
import { useAppStore } from "../../core/store";
import type { ExposureRef } from "../../core/types";
import { CONFIG } from "../../core/config";

type OrientedItem = {
    id: string;                // portal item id
    title?: string;
    access?: string;           // "public"
    serviceUrl?: string | null; // pode vir .../FeatureServer ou .../FeatureServer/0
};

function safeNum(v: any): number | null {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
}

function toEpochMs(v: any): number | null {
    if (v == null) return null;

    if (typeof v === "number" && Number.isFinite(v)) return v < 1e12 ? v * 1000 : v;

    if (typeof v === "string") {
        const n = Number(v);
        if (Number.isFinite(n)) return n < 1e12 ? n * 1000 : n;
        const t = Date.parse(v);
        return Number.isFinite(t) ? t : null;
    }

    if (v instanceof Date) return v.getTime();
    return null;
}

function ensureLayer0(url: string | null | undefined) {
    const u = (url || "").replace(/\/+$/, "");
    if (u.endsWith("/0")) return u;
    if (u.endsWith("/FeatureServer")) return `${u}/0`;
    // se vier .../FeatureServer/1 etc, mantém
    if (/\/FeatureServer\/\d+$/.test(u)) return u;
    return u;
}

function makeMsgId() {
    return `cmp:${Date.now()}:${Math.random().toString(16).slice(2)}`;
}

async function fetchOriented(): Promise<OrientedItem[]> {
    const r = await fetch(`${CONFIG.API_BASE}/oriented-imagery`, { credentials: "include" });
    const raw = await r.text();

    if (!r.ok) throw new Error(`GET /oriented-imagery falhou: HTTP ${r.status} — ${raw.slice(0, 200)}`);

    let data: any;
    try {
        data = JSON.parse(raw);
    } catch {
        throw new Error(`Resposta não-JSON em /oriented-imagery: ${raw.slice(0, 120)}`);
    }

    return Array.isArray(data) ? (data as OrientedItem[]) : [];
}

export function Setup360OnView(view: MapView) {
    const handles = new Handles();

    // layers carregadas automaticamente (todas do /oriented-imagery)
    let oiLayers: FeatureLayer[] = [];
    const created: FeatureLayer[] = [];
    let disposed = false;
    let initDone = false;
    let initPromise: Promise<void> | null = null;
    let unsubscribeStore: (() => void) | null = null;

    async function ensureLayersLoaded() {
        if (initDone) return;
        if (initPromise) return initPromise;

        initPromise = (async () => {
            const items = await fetchOriented();
            if (disposed) return;

            const defs = (items || [])
                .filter((it) => it?.serviceUrl)
                // se quiser garantir public mesmo quando backend vacila:
                .filter((it) => String(it.access || "").toLowerCase() === "public")
                .map((it) => ({
                    id: it.id,
                    title: it.title ?? "Imagem 360",
                    url0: ensureLayer0(String(it.serviceUrl)),
                }));

            for (const def of defs) {
                const id = `oi:${def.id}`;
                if (!view.map) continue;
                const existing = view.map.findLayerById(id) as FeatureLayer | null;

                if (existing) {
                    oiLayers.push(existing);
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
                oiLayers.push(layer);

                // não bloquear inicialização se alguma falhar
                layer.load().catch((e) => {
                    console.warn(`[Setup360] layer load falhou: ${def.title}`, e);
                });
            }

            initDone = true;

            // Fetch dates for calendar
            const fetchDates = async () => {
                if (disposed) return;
                const datesSet = new Set<string>();
                await Promise.all(oiLayers.map(async (lyr) => {
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
                        console.warn("[Setup360] falha ao buscar datas de", lyr.title);
                    }
                }));
                if (!disposed) {
                    useAppStore.getState().setImage360AvailableDates(datesSet);
                }
            };
            fetchDates();

            const applyFilter = async (filter: { start: number | null, end: number | null }) => {
                if (disposed) return;
                
                // Ensure layers are loaded so we can inspect layer.fields
                await Promise.all(oiLayers.map(lyr => lyr.load()));
                if (disposed) return;

                oiLayers.forEach(layer => {
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
            applyFilter(useAppStore.getState().image360DateFilter);

            // Subscribe to future changes
            let lastFilter = useAppStore.getState().image360DateFilter;
            unsubscribeStore = useAppStore.subscribe((state) => {
                const newFilter = state.image360DateFilter;
                if (newFilter.start !== lastFilter.start || newFilter.end !== lastFilter.end) {
                    lastFilter = newFilter;
                    applyFilter(newFilter);
                }
            });
        })();

        return initPromise;
    }

    // carrega assim que entra no módulo
    ensureLayersLoaded().catch((e) => console.warn("[Setup360] init error:", e));

    handles.add(
        view.on("click", async (ev) => {
            const {
                setLastClickedPoint,
                setCandidateExposures,
                setSelectedExposureLeft,
                setSelectedExposureRight,
            } = useAppStore.getState();

            if (!ev.mapPoint) return;

            const lastClickedPoint = {
                x: ev.mapPoint.x,
                y: ev.mapPoint.y,
                wkid: ev.mapPoint.spatialReference?.wkid,
            };
            setLastClickedPoint(lastClickedPoint);

            await ensureLayersLoaded();
            if (!oiLayers.length) return;

            // ✅ hitTest em TODAS as camadas oriented carregadas
            const hit = await view.hitTest(ev, { include: oiLayers });

            const graphics = hit.results
                .map((r) => (r as any).graphic || (r as __esri.GraphicHit).graphic)
                .filter((g) => {
                    const lyr: any = g?.layer;
                    return lyr && lyr.type === "feature" && String(lyr.id || "").startsWith("oi:") && g.attributes;
                }) as __esri.Graphic[];

            if (!graphics.length) {
                setCandidateExposures([]);
                setSelectedExposureLeft(null);
                setSelectedExposureRight(null);
                return;
            }

            // ✅ junta tudo (inclusive sobrepostos), dedupe por (layerUrl+oid)
            const uniq = new globalThis.Map<string, ExposureRef>();

            for (const g of graphics) {
                const lyr = g.layer as FeatureLayer;

                const oidField = lyr.objectIdField;
                const objectId = safeNum(g.attributes?.[oidField]);
                if (objectId == null) continue;

                const acqRaw =
                    g.attributes?.acquisitiondate ??
                    g.attributes?.acquisitionDate ??
                    g.attributes?.AcquisitionDate ??
                    null;

                const acqMs = toEpochMs(acqRaw);

                const layerUrl0 = ensureLayer0(lyr.url); // ✅ garante attachments

                const ref: ExposureRef = {
                    objectId,
                    layerUrl: layerUrl0,
                    title: g.attributes?.name ?? lyr.title ?? "Imagem 360",
                    attrs: { ...g.attributes, acquisitiondate: acqMs ?? null },
                    acquisitionDate: acqMs ?? undefined,
                };

                uniq.set(`${layerUrl0}::${objectId}`, ref);
            }

            const candidates = Array.from(uniq.values());

            // sort desc por data
            candidates.sort((a, b) => {
                const da = safeNum(a.attrs?.acquisitiondate) ?? 0;
                const db = safeNum(b.attrs?.acquisitiondate) ?? 0;
                return db - da;
            });

            setCandidateExposures(candidates);

            const first = candidates[0] ?? null;
            setSelectedExposureLeft(first);
            setSelectedExposureRight(first);

            // ======== NOVA ABA ========
            const msgId = makeMsgId();
            const base = window.location.origin;

            const url = `${base}/view360?mid=${encodeURIComponent(msgId)}`;
            const win = window.open(url, "_blank");

            if (!win) {
                console.warn("[Setup360] popup bloqueado pelo navegador.");
                return;
            }

            const payload = {
                __type: "DNIT_COMPARE_INIT",
                msgId,
                lastClickedPoint,
                candidates,
                left: first,
                right: first,
            };

            const targetOrigin = base;
            let attempts = 0;

            const timer = window.setInterval(() => {
                attempts++;
                try {
                    win.postMessage(payload, targetOrigin);
                } catch { }
                if (attempts >= 30) window.clearInterval(timer);
            }, 100);

            const ackHandler = (e: MessageEvent) => {
                if (e.origin !== targetOrigin) return;
                const data: any = e.data;
                if (data?.__type === "DNIT_COMPARE_ACK" && data?.msgId === msgId) {
                    window.clearInterval(timer);
                    window.removeEventListener("message", ackHandler);
                }
            };
            window.addEventListener("message", ackHandler);
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
