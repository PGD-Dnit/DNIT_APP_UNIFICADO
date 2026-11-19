// src/hooks/useObraDetails.ts
import { useEffect, useState } from "react";
import {
  consultarObra,
  type ConsultaObraResponse,
  type ObraRegistroArcgis,
  type ObraRegistroBanco,
} from "../services/obraService";

export function getObraStatusClass(statusStr: string): string {
  const low = statusStr.toLowerCase();
  if (low.includes("finaliza")) return "finalizada";
  if (low.includes("andamento")) return "em_andamento";
  if (low.includes("emergên") || low.includes("paralis")) return "emergencial";
  return "";
}

export function useObraDetails(id: string, globalid: string) {
  const [data, setData] = useState<ConsultaObraResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  useEffect(() => {
    if (!id || !globalid) {
      setError("Parâmetros 'id' ou 'globalid' ausentes na URL.");
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    consultarObra(id, globalid)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.error("[api] Erro ao consultar obra:", err);
          setError(err?.message || "Falha ao carregar os dados da obra.");
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [id, globalid]);

  const registrosBanco: ObraRegistroBanco[] = data?.banco?.registros ?? [];
  const regBanco: ObraRegistroBanco | null = registrosBanco[activeTab] ?? registrosBanco[0] ?? null;
  const regArcgis: ObraRegistroArcgis | null = data?.arcgis?.camadas?.[0]?.registros?.[0] ?? null;
  const nomeCamada = data?.arcgis?.camadas?.[0]?.title ?? regBanco?.NomeCamada ?? "Obra";
  const nomeObra = regBanco?.NomeObra || regArcgis?.nome_obra || "Detalhes da Obra";
  const status = regBanco?.Status || regArcgis?.status || "N/A";

  return {
    data,
    loading,
    error,
    activeTab,
    setActiveTab,
    registrosBanco,
    regBanco,
    regArcgis,
    nomeCamada,
    nomeObra,
    status,
  };
}

