const apiBase = import.meta.env.VITE_API_URL?.trim() || "/consumeapi";

export const CONFIG = {
  ARCGIS_PORTAL: "https://sig.dnit.gov.br/portal",
  API_BASE: apiBase.replace(/\/$/, ""),
  BASEMAP: "hybrid" as const,
  //BASEMAP: "gray-vector" as const,
} as const;

console.log("CONFIG.API_BASE =", CONFIG.API_BASE);




/* export const CONFIG = {
  ARCGIS_PORTAL: "https://sig.dnit.gov.br/portal",

  IMAGENS360_LAYER_URL:
    "https://sig.dnit.gov.br/server/rest/services/Hosted/Imagens360_clayton/FeatureServer/0",
  API_BASE: (import.meta.env.VITE_API_URL || "http://localhost:3001").replace(/\/$/, ""),
  BASEMAP: "hybrid" as const,
} as const;

// debug temporário
console.log("CONFIG.API_BASE =", CONFIG.API_BASE); */