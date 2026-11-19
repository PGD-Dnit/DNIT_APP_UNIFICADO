// src/utils/formatters.ts
export function formatDatePtBr(dateStr?: string | null, fallback = "N/A"): string {
  if (!dateStr) return fallback;
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function formatDateUtcPtBr(iso?: string | null, fallback = "—"): string {
  if (!iso) return fallback;
  try {
    const date = new Date(iso);
    if (isNaN(date.getTime())) return iso;
    return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
  } catch {
    return iso;
  }
}

export function formatCurrencyBrl(val?: number | null, fallback = "R$ 0,00"): string {
  if (typeof val !== "number" || !Number.isFinite(val)) return fallback;
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(val);
}

export function formatMosaicDateLabel(rawWhen?: string | null, fallback = "?"): string {
  if (!rawWhen) return fallback;
  const str = String(rawWhen);
  const match3 = str.match(/(\d{4})[-_/.](\d{2})[-_/.](\d{2})/);
  if (match3) return `${match3[3]}/${match3[2]}/${match3[1]}`;

  const match2 = str.match(/(\d{4})[-_/.](\d{2})/);
  if (match2) {
    const y = parseInt(match2[1], 10);
    const mo = parseInt(match2[2], 10);
    const endD = String(new Date(y, mo, 0).getDate()).padStart(2, "0");
    return `${endD}/${match2[2]}/${match2[1]}`;
  }

  return str;
}

export function removeAccents(value?: string | null): string {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

