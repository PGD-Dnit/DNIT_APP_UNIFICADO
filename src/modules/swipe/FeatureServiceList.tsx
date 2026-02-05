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




/* import React from "react";

interface FeatureService {
  id: string;
  title: string;
  featureUrl: string;
}

interface Props {
  services?: FeatureService[];
  onToggleLayer: (layerUrl: string, visible: boolean) => void;
  mapReady: boolean; // indica se o mapa está pronto
}

const FeatureServiceList: React.FC<Props> = ({ services = [], onToggleLayer, mapReady }) => {
  const handleChange = (serviceId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    onToggleLayer(serviceId, e.target.checked);
  };

  if (!Array.isArray(services) || services.length === 0) {
    return <p>Nenhum Feature Service encontrado.</p>;
  }

  if (!mapReady) {
    // mapa ainda não está pronto, lista fica oculta
    return null;
  }

  return (
    <div>
      {services.map((srv) => (
        <div key={srv.id}>
          <label>
            <input
              type="checkbox"
              onChange={(e) => handleChange(srv.id, e)}
            />
            {srv.title}
          </label>
        </div>
      ))}
    </div>
  );
};

export default FeatureServiceList; */



/* // FeatureServiceList.jsx
import React from "react";

const FeatureServiceList = ({ services = [], onToggleLayer }) => {
  const handleChange = (serviceId, e) => {
    onToggleLayer(serviceId, e.target.checked);
  };

  if (!Array.isArray(services) || services.length === 0) {
    return <p>Nenhum Feature Service encontrado.</p>;
  }

  return (
    <div>
      {services.map((srv) => (
        <div key={srv.id}>
          <label>
            <input
              type="checkbox"
              onChange={(e) => handleChange(srv.id, e)}
            />
            {srv.title}
          </label>
        </div>
      ))}
    </div>
  );
};

export default FeatureServiceList;
 */