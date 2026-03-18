import IconCheckbox from "./IconCheckbox";

interface FeatureService {
  id: string;
  title: string;
  featureUrl: string;
}

interface Props {
  services: FeatureService[];
  onToggleLayer: (layerUrl: string, visible: boolean) => void;
  visible?: boolean;
  activeLayerUrls: string[];
}

const FeatureServiceList: React.FC<Props> = ({
  services,
  onToggleLayer,
  visible = true,
  activeLayerUrls,
}) => {
  if (!visible) return null;
  if (!services?.length) return <p>Nenhum Feature Service encontrado.</p>;

  return (
    <div style={{ display: "grid", gap: 8 }}>
      {services.map((srv) => {
        const checked = activeLayerUrls.includes(srv.featureUrl);
        return (
          <IconCheckbox
            key={srv.id}
            checked={checked}
            onToggle={() => onToggleLayer(srv.featureUrl, !checked)}
            label={srv.title}
          />
        );
      })}
    </div>
  );
};

export default FeatureServiceList;

