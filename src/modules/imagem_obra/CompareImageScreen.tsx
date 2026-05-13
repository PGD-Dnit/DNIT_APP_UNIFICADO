// src/modules/imagem_obra/CompareImageScreen.tsx
import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../core/store";
import DualImageViewer from "./DualImageViewer";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import MiniMapImageView from "./MiniMapImageView";
import ImageToggleBtn from "./ImageToggleBtn";
import ImageGallery, { type AttachmentItem } from "./ImageGallery";
import "./CompareImageScreen.css";

type Att = { id: number; name?: string; contentType?: string; size?: number };
type ImgStatus = "waiting" | "loading" | "empty" | "ready";

function filterImages(atts: Att[]): Att[] {
    const imgs = atts.filter((a) => (a.contentType || "").startsWith("image/"));
    const base = imgs.length ? imgs : atts;
    return base.slice().sort((a, b) => (b.size || 0) - (a.size || 0));
}

function normalizeDay(d: Date) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function sameDay(a: Date, b: Date) {
    return (
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate()
    );
}

/** Hook interno que carrega todos os attachments de um ExposureRef */
function useAllAttachments(
    exp: ReturnType<typeof useAppStore>["selectedImageLeft"] | null,
    setStoreImg: (p: any) => void
) {
    const [status, setStatus] = useState<ImgStatus>("waiting");
    const [url, setUrl] = useState<string | null>(null);
    const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
    const [selectedAttId, setSelectedAttId] = useState<number | null>(null);

    useEffect(() => {
        if (!exp) {
            setStatus("waiting"); setUrl(null); setAttachments([]); setSelectedAttId(null); setStoreImg(null);
            return;
        }
        let cancelled = false;
        setStatus("loading"); setUrl(null); setAttachments([]); setSelectedAttId(null); setStoreImg(null);

        (async () => {
            try {
                const list = await listAttachments(exp.layerUrl, exp.objectId);
                if (cancelled) return;
                const sorted = filterImages(list);
                if (!sorted.length) { setStatus("empty"); return; }

                const items: AttachmentItem[] = sorted.map((a) => ({
                    id: a.id, name: a.name, contentType: a.contentType, size: a.size,
                    url: buildAttachmentUrl(exp.layerUrl, exp.objectId, a.id),
                }));

                setAttachments(items);
                const first = items[0];
                setSelectedAttId(first.id);
                setUrl(first.url);
                setStatus("ready");
                setStoreImg({ objectId: exp.objectId, attachmentId: first.id, url: first.url, name: first.name, contentType: first.contentType });
            } catch { if (!cancelled) setStatus("empty"); }
        })();

        return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [exp?.layerUrl, exp?.objectId]);

    const select = (att: AttachmentItem, exp2: typeof exp) => {
        if (!exp2) return;
        setSelectedAttId(att.id);
        setUrl(att.url);
        setStoreImg({ objectId: exp2.objectId, attachmentId: att.id, url: att.url, name: att.name, contentType: att.contentType });
    };

    return { status, url, attachments, selectedAttId, select };
}

export default function CompareImageScreen() {
    const candidateImages = useAppStore((s) => s.candidateImages);

    const leftExp = useAppStore((s) => s.selectedImageLeft);
    const setLeftExp = useAppStore((s) => s.setSelectedImageLeft);

    const rightExp = useAppStore((s) => s.selectedImageRight);
    const setRightExp = useAppStore((s) => s.setSelectedImageRight);

    const setImageLeft = useAppStore((s) => s.setImageLeft);
    const setImageRight = useAppStore((s) => s.setImageRight);

    const left = useAllAttachments(leftExp, setImageLeft);
    const right = useAllAttachments(rightExp, setImageRight);

    const markedDates = useMemo(() => {
        return candidateImages
            .map((c) => c.attrs?.acquisitiondate)
            .filter((v) => typeof v === "number" && Number.isFinite(v))
            .map((ms) => normalizeDay(new Date(ms as number)));
    }, [candidateImages]);

    const selectedLeftDate = useMemo(() => {
        const ms = leftExp?.attrs?.acquisitiondate;
        if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
        return normalizeDay(new Date(ms));
    }, [leftExp]);

    const selectedRightDate = useMemo(() => {
        const ms = rightExp?.attrs?.acquisitiondate;
        if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
        return normalizeDay(new Date(ms));
    }, [rightExp]);

    const onPickLeft = (d: Date) => {
        const dd = normalizeDay(d);
        const found = candidateImages.find((c) => {
            const ms = c.attrs?.acquisitiondate;
            if (typeof ms !== "number") return false;
            return sameDay(normalizeDay(new Date(ms)), dd);
        });
        if (found) setLeftExp(found);
    };

    const onPickRight = (d: Date) => {
        const dd = normalizeDay(d);
        const found = candidateImages.find((c) => {
            const ms = c.attrs?.acquisitiondate;
            if (typeof ms !== "number") return false;
            return sameDay(normalizeDay(new Date(ms)), dd);
        });
        if (found) setRightExp(found);
    };

    return (
        <div className="cps">
            <div className="cps__viewer">
                <DualImageViewer
                    urlLeft={left.url ?? undefined}
                    urlRight={right.url ?? undefined}
                    statusLeft={left.status}
                    statusRight={right.status}
                />
            </div>

            <div className="cps__panel-left">
                <div className="cps__calendarLabel">Data (Esquerda)</div>
                <MarkedCalendar markedDates={markedDates} onPick={onPickLeft} selectedDate={selectedLeftDate} />
            </div>

            <div className="cps__panel-right">
                <div className="cps__calendarLabel">Data (Direita)</div>
                <MarkedCalendar markedDates={markedDates} onPick={onPickRight} selectedDate={selectedRightDate} />
            </div>

            <div className="cps__minimap">
                <MiniMapImageView defaultZoom={18} />
            </div>

            {/* Galeria — clique escolhe o mesmo attachment para ambos os lados */}
            <ImageGallery
                attachments={left.attachments}
                selectedId={left.selectedAttId}
                onSelect={(att) => {
                    left.select(att, leftExp);
                    right.select(att, rightExp);
                }}
            />

            <ImageToggleBtn />
        </div>
    );
}
