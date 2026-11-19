import { CONFIG } from "./config";
import { getAuthHeaders } from "../services/authService";
import { useAuthStore } from "./authStore";

function isAllowedBackendUrl(url: string): boolean {
  try {
    const targetOrigin = new URL(url, window.location.origin).origin;
    const apiOrigin = new URL(CONFIG.API_BASE, window.location.origin).origin;
    return targetOrigin === window.location.origin || targetOrigin === apiOrigin;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(pathOrUrl: string, init?: RequestInit): Promise<T> {
  const isRelative = !/^https?:\/\//i.test(pathOrUrl);
  const url = isRelative ? `${CONFIG.API_BASE}${pathOrUrl}` : pathOrUrl;
  const isBackendUrl = isRelative || isAllowedBackendUrl(url);

  const r = await fetch(url, {
    ...init,
    credentials: isBackendUrl ? "include" : "omit",
    headers: {
      ...(isBackendUrl ? getAuthHeaders() : {}),
      ...(init?.headers || {}),
    },
  });

  const text = await r.text();
  let data: Record<string, any> | null = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // resposta não-JSON
  }

  if (!r.ok) {
    if (isBackendUrl && r.status === 401) {
      useAuthStore.getState().handleUnauthorized("Sua sessão expirou. Faça login novamente.");
    }
    const msg =
      data?.erro ||
      data?.error ||
      data?.mensagem ||
      text.slice(0, 200) ||
      `Erro HTTP ${r.status} em ${url}`;
    throw new Error(msg);
  }

  if (data === null && text.trim().length > 0) {
    throw new Error(`Resposta não-JSON em ${url}: ${text.slice(0, 120)}`);
  }

  return data as T;
}

export type PlanetMosaic = {
  id: string;
  title: string;
  format: string;
  tileUrl: string;
  captured?: string;
  bbox?: [number, number, number, number];
};

export type WaybackRelease = {
  id: string;
  title: string;
  releaseDate: string;
  releaseNum: number;
  tileUrl: string;
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
  const data = await apiRequest<any>(url);
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
  exifInfo?: any;
  keywords?: string;
};

export async function listAttachmentsWithMeta(
  layerUrl: string,
  objectId: number
): Promise<AttachmentInfoEx[]> {
  const url = `${layerUrl}/${objectId}/attachments?f=json&returnMetadata=true`;
  const data = await apiRequest<any>(url);
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

export const apiClient = {
  health: () => apiRequest(`/health`),

  planetMosaics: (q = "", limit = 200) =>
    apiRequest<PlanetMosaic[]>(
      `/planet/mosaics?q=${encodeURIComponent(q)}&limit=${limit}`
    ),

  wayback: (limit = 200) => apiRequest<WaybackRelease[]>(`/wayback?limit=${limit}`),

  orientedImagery: (limit = 50) =>
    apiRequest<OrientedItem[]>(`/oriented-imagery?limit=${limit}`),

  features: (limit = 50) => apiRequest<any[]>(`/features?limit=${limit}`),
};

export async function getPlanetMosaicsRaw(limit = 200): Promise<PlanetMosaic[]> {
  return apiClient.planetMosaics("", limit);
}
