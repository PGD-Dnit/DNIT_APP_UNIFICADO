// src/modules/imagem_obra/SingleImageScreen.tsx
import { useEffect, useMemo, useState } from "react";

import { useAppStore } from "../../core/store";
import { listAttachments, buildAttachmentUrl } from "../../core/apiClient";
import { MarkedCalendar } from "../../components/MarkedCalendar";
import MiniMapImageView from "./MiniMapImageView";
import SingleImageViewer from "./SingleImageViewer";
// import ImageToggleBtn from "./ImageToggleBtn";
import ImageGallery, { type AttachmentItem } from "./ImageGallery";

import "./SingleImageScreen.css";

type Att = { id: number; name?: string; contentType?: string; size?: number };
type ImgStatus = "waiting" | "loading" | "empty" | "ready";

/** Filtra só imagens e ordena por tamanho desc (maior = melhor qualidade). */
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

function EmptyState({ icon, msg, sub, showCloseBtn }: { icon: string; msg: string; sub?: string; showCloseBtn?: boolean }) {
    return (
        <div className="sis__empty">
            <div className="sis__empty__card">
                <i className={`fa-solid ${icon} sis__empty__icon`} />
                <span>{msg}</span>
                {sub && <span className="sis__empty__sub">{sub}</span>}
                {showCloseBtn && (
                    <button className="sis__close-btn" onClick={() => window.close()}>
                        Fechar aba
                    </button>
                )}
            </div>
        </div>
    );
}

export default function SingleImageScreen() {
    const candidateImages = useAppStore((s) => s.candidateImages);
    const lastClickedPoint = useAppStore((s) => s.lastClickedPoint);
    const leftExp = useAppStore((s) => s.selectedImageLeft);
    const setLeftExp = useAppStore((s) => s.setSelectedImageLeft);
    const setImageLeft = useAppStore((s) => s.setImageLeft);

    interface ImageState {
        status: ImgStatus;
        url: string | null;
        attachments: AttachmentItem[];
        selectedAttId: number | null;
    }

    const [imageState, setImageState] = useState<ImageState>({
        status: "waiting",
        url: null,
        attachments: [],
        selectedAttId: null,
    });

    const { status: imgStatus, url: imgUrl, attachments, selectedAttId } = imageState;

    // Carrega TODOS os attachments quando o feature (ExposureRef) muda
    useEffect(() => {
        if (!leftExp) {
            setImageState({
                status: (lastClickedPoint && candidateImages.length === 0) ? "empty" : "waiting",
                url: null,
                attachments: [],
                selectedAttId: null,
            });
            setImageLeft(null);
            return;
        }

        let cancelled = false;
        setImageState({
            status: "loading",
            url: null,
            attachments: [],
            selectedAttId: null,
        });
        setImageLeft(null);

        (async () => {
            try {
                const list = await listAttachments(leftExp.layerUrl, leftExp.objectId);
                if (cancelled) return;

                const sorted = filterImages(list);
                if (!sorted.length) {
                    setImageState({
                        status: "empty",
                        url: null,
                        attachments: [],
                        selectedAttId: null,
                    });
                    return;
                }

                // Constrói a lista de AttachmentItem com URL pronta
                const items: AttachmentItem[] = sorted.map((a) => ({
                    id: a.id,
                    name: a.name,
                    contentType: a.contentType,
                    size: a.size,
                    url: buildAttachmentUrl(leftExp.layerUrl, leftExp.objectId, a.id),
                }));

                // Seleciona o primeiro automaticamente
                const first = items[0];
                setImageState({
                    status: "ready",
                    url: first.url,
                    attachments: items,
                    selectedAttId: first.id,
                });
                setImageLeft({
                    objectId: leftExp.objectId,
                    attachmentId: first.id,
                    url: first.url,
                    name: first.name ?? undefined,
                    contentType: first.contentType ?? undefined,
                });
            } catch {
                if (!cancelled) {
                    setImageState({
                        status: "empty",
                        url: null,
                        attachments: [],
                        selectedAttId: null,
                    });
                }
            }
        })();

        return () => { cancelled = true; };
    }, [leftExp?.layerUrl, leftExp?.objectId, leftExp, setImageLeft, lastClickedPoint, candidateImages.length]);

    // Clique na galeria → troca o attachment exibido
    const handleGallerySelect = (att: AttachmentItem) => {
        if (!leftExp) return;
        setImageState((prev) => ({
            ...prev,
            selectedAttId: att.id,
            url: att.url,
        }));
        setImageLeft({
            objectId: leftExp.objectId,
            attachmentId: att.id,
            url: att.url,
            name: att.name ?? undefined,
            contentType: att.contentType ?? undefined,
        });
    };

    // Datas marcadas no calendário (por feature/ExposureRef)
    const markedDates = useMemo(() => {
        return candidateImages
            .map((c) => c.attrs?.acquisitiondate)
            .filter((v) => typeof v === "number" && Number.isFinite(v))
            .map((ms) => normalizeDay(new Date(ms)));
    }, [candidateImages]);

    // Data selecionada atual
    const selectedDate = useMemo(() => {
        const ms = leftExp?.attrs?.acquisitiondate;
        if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
        return normalizeDay(new Date(ms));
    }, [leftExp]);

    // Troca de feature ao clicar no calendário
    const onPickDate = (d: Date) => {
        const dd = normalizeDay(d);
        const found = candidateImages.find((c) => {
            const ms = c.attrs?.acquisitiondate;
            if (typeof ms !== "number" || !Number.isFinite(ms)) return false;
            return sameDay(normalizeDay(new Date(ms)), dd);
        });
        if (found) setLeftExp(found);
    };

    function renderViewer() {
        switch (imgStatus) {
            case "waiting":
                return <EmptyState icon="fa-map-location-dot" msg="Clique em um ponto do mapa para visualizar a imagem" />;
            case "loading":
                return <EmptyState icon="fa-circle-notch fa-spin" msg="Carregando imagem da obra…" />;
            case "empty":
                return (
                    <EmptyState
                        icon="fa-image-slash"
                        msg="Nenhuma imagem disponível para este ponto"
                        sub="Tente selecionar outro ponto no mini-mapa"
                        showCloseBtn={true}
                    />
                );
            case "ready":
                return imgUrl ? <SingleImageViewer url={imgUrl} /> : null;
        }
    }

    return (
        <div className="sis">
            {/* Viewer 2D ocupa todo o fundo */}
            <div className="sis__viewer">
                {renderViewer()}
            </div>

            {/* Calendário — canto superior esquerdo (só com múltiplos features/datas) */}
            {markedDates.length > 0 && (
                <div className="sis__calendar">
                    <div className="sis__calendarLabel">Datas disponíveis</div>
                    <MarkedCalendar
                        markedDates={markedDates}
                        onPick={onPickDate}
                        selectedDate={selectedDate}
                    />
                </div>
            )}

            {/* Mini mapa — canto inferior esquerdo */}
            <div className="sis__minimap">
                <MiniMapImageView defaultZoom={18} />
            </div>

            {/* Galeria de attachments — canto direito (só com 2+ fotos) */}
            <ImageGallery
                attachments={attachments}
                selectedId={selectedAttId}
                onSelect={handleGallerySelect}
            />

            {/* Botão Comparar/Voltar — centro inferior */}
            {/*  <ImageToggleBtn /> */}
        </div>
    );
}
