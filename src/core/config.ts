const apiBase = import.meta.env.VITE_API_URL?.trim() || "/consumeapi";

export const CONFIG = {
  ARCGIS_PORTAL: "https://sig.dnit.gov.br/portal",
  API_BASE: apiBase.replace(/\/$/, ""),
  BASEMAP: "hybrid" as const,
} as const;
