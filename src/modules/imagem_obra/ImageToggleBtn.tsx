// src/modules/imagem_obra/ImageToggleBtn.tsx
import { useNavigate, useLocation } from "react-router-dom";
import "./ImageToggleBtn.css";

export default function ImageToggleBtn() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isCompare = pathname.startsWith("/compare-image");

  const handleClick = () => {
    // preserva ?mid para que o sessionStorage funcione após F5
    const mid = new URLSearchParams(window.location.search).get("mid");
    const midParam = mid ? `?mid=${encodeURIComponent(mid)}` : "";

    if (isCompare) {
      navigate(`/view-image${midParam}`);
    } else {
      navigate(`/compare-image${midParam}`);
    }
  };

  return (
    <button
      type="button"
      className="image-toggle-btn"
      onClick={handleClick}
      title={isCompare ? "Voltar para imagem única" : "Ver comparação lado a lado"}
    >
      {isCompare ? (
        <>
          <i className="fa-solid fa-image image-toggle-btn__icon" />
          <span>Voltar</span>
        </>
      ) : (
        <>
          <i className="fa-solid fa-code-compare image-toggle-btn__icon" />
          <span>Comparar</span>
        </>
      )}
    </button>
  );
}
