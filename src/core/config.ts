export const CONFIG = {
  // Ajuste para seu Portal / Server
  ARCGIS_PORTAL: "https://sig.dnit.gov.br/portal",

  // Exemplo: FeatureServer que tem os exposure points / imagens 360
  // (troque para o seu real)
  IMAGENS360_LAYER_URL:
    "https://sig.dnit.gov.br/server/rest/services/Hosted/Imagens360_clayton/FeatureServer/0",

  // Basemap simples (pode trocar por Planet depois via consome_api)
  API_BASE: "http://localhost:3001", // seu express
  BASEMAP: "hybrid" as const,

};
