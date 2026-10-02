// src/core/mosaicUtils.ts
//
// Utilitários de mosaico agnósticos à fonte (Planet, Wayback, etc.).
// Centraliza a construção de tile URLs e facilita a troca de provedor
// sem precisar alterar múltiplos arquivos.

import { CONFIG } from "./config";

// ---------------------------------------------------------------------------
// Tipos
// ---------------------------------------------------------------------------

/** Provedores de mosaico suportados. Adicionar novos aqui conforme necessário. */
export type MosaicProvider = "planet" | "wayback";

// ---------------------------------------------------------------------------
// Construção de URL
// ---------------------------------------------------------------------------

/**
 * Constrói a URL de tile XYZ para um mosaico Planet.
 *
 * @param mosaicId  ID do mosaico (ex: "global_monthly_2026_05_mosaic")
 * @returns Template de URL compatível com ArcGIS WebTileLayer
 *
 * @example
 * buildPlanetTileUrl("global_monthly_2026_05_mosaic")
 * // → "http://localhost:3001/planet/tiles/{z}/{x}/{y}.png?mosaic=global_monthly_2026_05_mosaic"
 */
export function buildPlanetTileUrl(mosaicId: string): string {
  if (mosaicId === "esri-wayback") {
    return buildWaybackTileUrl();
  }
  return `${CONFIG.API_BASE}/planet/tiles/{z}/{x}/{y}.png?mosaic=${mosaicId}`;
}

/**
 * Constrói a URL de tile XYZ para um mosaico Wayback (ESRI World Imagery Wayback).
 * Retorna o template de URL para o mosaico mais recente do Wayback.

 * @returns Template de URL compatível com ArcGIS WebTileLayer
 */
export function buildWaybackTileUrl(): string {
  return `${CONFIG.API_BASE}/wayback/tile/{level}/{row}/{col}`;
}

/**
 * Constrói a URL de tile para qualquer provedor suportado.
 * Ponto de entrada único — facilita a futura lógica de fallback.
 *
 * @param provider  Provedor ("planet" | "wayback")
 * @param id        ID do mosaico ou release
 */
export function buildMosaicTileUrl(provider: MosaicProvider, id: string): string {
  switch (provider) {
    case "wayback":
      return buildWaybackTileUrl();
    case "planet":
    default:
      return buildPlanetTileUrl(id);
  }
}
