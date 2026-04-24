// src/modules/imagem_360/PanoToggleBtn.tsx
// Botão único que alterna entre a tela de 1 imagem (/view360) e 2 imagens (/compare).
import { useNavigate, useLocation } from "react-router-dom";
import "./PanoToggleBtn.css";

export default function PanoToggleBtn() {
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const isCompare = pathname.startsWith("/compare");

  const handleClick = () => {
    if (isCompare) {
      navigate("/view360");
    } else {
      navigate("/compare");
    }
  };

  return (
    <button
      type="button"
      className="pano-toggle-btn"
      onClick={handleClick}
      title={isCompare ? "Voltar para imagem única" : "Ver comparação lado a lado"}
    >
      {isCompare ? (
        <>
          <i className="fa-solid fa-image pano-toggle-btn__icon" />
          <span>Voltar</span>
        </>
      ) : (
        <>
          <i className="fa-solid fa-code-compare pano-toggle-btn__icon" />
          <span>Comparar</span>
        </>
      )}
    </button>
  );
}
