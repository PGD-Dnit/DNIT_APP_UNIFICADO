import { CONFIG } from "./config";

/* =========================
   Helpers
   ========================= */
async function getJson<T>(pathOrUrl: string): Promise<T> {
  // se vier url absoluta (http...), usa como está
  const url = /^https?:\/\//i.test(pathOrUrl)
    ? pathOrUrl
    : `${CONFIG.API_BASE}${pathOrUrl}`;

  const r = await fetch(url, { credentials: "include" });
  const text = await r.text();

  if (!r.ok) {
    throw new Error(`GET ${url} falhou: HTTP ${r.status} — ${text.slice(0, 200)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Resposta não-JSON em ${url}: ${text.slice(0, 120)}`);
  }
}

/* =========================
   Tipos do seu backend (Express)
   ========================= */
export type PlanetMosaic = {
  id: string;
  title: string;
  format: string;
  tileUrl: string; // template do seu proxy
  captured?: string; // "YYYY-MM"
  bbox?: [number, number, number, number];
};

export type WaybackRelease = {
  id: string;
  title: string;
  releaseDate: string;
  releaseNum: number;
  tileUrl: string; // template WMTS->XYZ já pronto
};

export type OrientedItem = {
  id: string;
  title: string;
  descricao?: string;
  tipo?: string;
  owner?: string;
  access?: string;
  serviceUrl?: string;
  portalItemUrl?: string;
  thumbnailUrl?: string;
};

/* =========================
   Attachments (ArcGIS FeatureServer)
   ========================= */
export type AttachmentInfo = {
  id: number;
  name?: string;
  contentType?: string;
  size?: number;
};

export async function listAttachments(
  layerUrl: string,
  objectId: number
): Promise<AttachmentInfo[]> {
  const url = `${layerUrl}/${objectId}/attachments?f=json`;
  const data = await getJson<any>(url);

  const infos = Array.isArray(data?.attachmentInfos) ? data.attachmentInfos : [];

  return infos
    .map((a: any) => ({
      id: a.id ?? a.attachmentid ?? a.attachmentId,
      name: a.name ?? a.att_name ?? a.attName,
      contentType: a.contentType ?? a.content_type,
      size: a.size ?? a.data_size ?? a.dataSize,
    }))
    .filter((a: AttachmentInfo) => Number.isFinite(a.id));
}


export function buildAttachmentUrl(
  layerUrl: string,
  objectId: number,
  attachmentId: number
) {
  return `${layerUrl}/${objectId}/attachments/${attachmentId}`;
}

export type AttachmentInfoEx = {
  id: number;
  name?: string;
  contentType?: string;
  size?: number;
  exifInfo?: any;        // quando disponível
  keywords?: string;     // quando disponível
};

export async function listAttachmentsWithMeta(
  layerUrl: string,
  objectId: number
): Promise<AttachmentInfoEx[]> {
  const url = `${layerUrl}/${objectId}/attachments?f=json&returnMetadata=true`;
  const data = await getJson<any>(url);

  const infos = Array.isArray(data?.attachmentInfos) ? data.attachmentInfos : [];

  return infos
    .map((a: any) => ({
      id: a.id ?? a.attachmentid ?? a.attachmentId,
      name: a.name ?? a.att_name ?? a.attName,
      contentType: a.contentType ?? a.content_type,
      size: a.size ?? a.data_size ?? a.dataSize,
      exifInfo: a.exifInfo ?? a.exifinfo ?? null,
      keywords: a.keywords ?? "",
    }))
    .filter((a: AttachmentInfoEx) => Number.isFinite(a.id));
}


/* =========================
   Client principal (seu Express)
   ========================= */
export const apiClient = {
  health: () => getJson(`/health`),

  planetMosaics: (q = "", limit = 200) =>
    getJson<PlanetMosaic[]>(
      `/planet/mosaics?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  wayback: (limit = 200) => getJson<WaybackRelease[]>(`/wayback?limit=${limit}`),

  orientedImagery: (limit = 50) =>
    getJson<OrientedItem[]>(`/oriented-imagery?limit=${limit}`),

  features: (limit = 50) => getJson<any[]>(`/features?limit=${limit}`),
};
