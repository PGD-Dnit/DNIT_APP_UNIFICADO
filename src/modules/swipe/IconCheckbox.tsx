import { FaRegEye , FaRegEyeSlash } from "react-icons/fa";

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

/**
 * Checkbox por ícone, acessível.
 * Usa <button role="checkbox"> para suportar teclado e leitores de tela.
 */
const IconCheckbox: React.FC<Props> = ({ checked, onToggle, label }) => {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      onClick={onToggle}
      onKeyDown={(e) => {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onToggle();
        }
      }}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        cursor: "pointer",
        background: "transparent",
        border: "1px solid #e5e7eb",
        //borderRadius: 8,
        borderRadius: 5,
        //padding: "10px 12px",
        padding: "5px 6px",     
        
      }}
      title={label}
    >
      <span>{label}</span>
      {checked ? (
        <FaRegEye size={15} color="#000000ff" />
      ) : (
        < FaRegEyeSlash size={15} color="#6b7280" />
      )}
      
    </button>
  );
};

export default IconCheckbox;
