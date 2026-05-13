// src/modules/imagem_obra/ImageGallery.tsx
//
// Galeria vertical que exibe TODOS os attachments do ExposureRef selecionado.
// O componente pai (SingleImageScreen / CompareImageScreen) já fez o fetch
// e passa a lista pronta — a galeria só renderiza e dispara onSelect.
import "./ImageGallery.css";

export type AttachmentItem = {
    id: number;
    name?: string;
    contentType?: string;
    size?: number;
    url: string;
};

type Props = {
    attachments: AttachmentItem[];
    selectedId?: number | null;
    onSelect: (att: AttachmentItem) => void;
};

export default function ImageGallery({ attachments, selectedId, onSelect }: Props) {
    if (attachments.length <= 1) return null;

    return (
        <div className="img-gallery">
            <div className="img-gallery__label">
                <i className="fa-solid fa-images img-gallery__label-icon" />
                {attachments.length} fotos
            </div>

            <div className="img-gallery__list">
                {attachments.map((att, i) => {
                    const isActive = att.id === selectedId;

                    return (
                        <button
                            key={att.id}
                            type="button"
                            className={`img-gallery__item${isActive ? " img-gallery__item--active" : ""}`}
                            onClick={() => onSelect(att)}
                            title={att.name || `Foto ${i + 1}`}
                        >
                            <img
                                src={att.url}
                                alt={att.name || `Foto ${i + 1}`}
                                className="img-gallery__thumb"
                                loading="lazy"
                            />

                            <span className="img-gallery__index">{i + 1}</span>

                            {isActive && <div className="img-gallery__active-bar" />}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
