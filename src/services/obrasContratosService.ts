// src/services/obrasContratosService.ts
import { apiRequest } from "../core/apiClient";

const BASE_PATH = "/obras-contratos";

export interface ObraSelecao {
  GlobalId: string;
  NomeObra: string;
  Status: string;
}

export interface Contrato {
  ContratoId: number;
  NumeroContrato: string;
  NumeroEdital?: string;
  NumeroProcesso?: string;
  ObjetoContratacao?: string;
  EmpresaId?: number;
  SituacaoId?: number;
  SituacaoDescricao?: string;
  ModalidadeLicitacao?: string;
  Programa?: string;
  TipoContrato?: string;
  DataInicio?: string;
  DataTerminoVigencia?: string;
  DataTerminoAtualizada?: string;
  ValorInicial?: number;
  ValorSaldo?: number;
}

export interface VinculoObraContrato {
  VinculoId: number;
  DataVinculo: string;
  GlobalId: string;
  NomeObra: string;
  StatusObra: string;
  ContratoId: number;
  NumeroContrato: string;
  NumeroEdital?: string;
  NumeroProcesso?: string;
  ObjetoContratacao?: string;
  SituacaoContratoDescricao?: string;
  DataInicio?: string;
  DataTerminoVigencia?: string;
  DataTerminoAtualizada?: string;
  ValorInicial?: number;
  ValorSaldo?: number;
}

function request<T>(path: string, init?: RequestInit): Promise<T> {
  return apiRequest<T>(`${BASE_PATH}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
  });
}

export const normalizarGuid = (g?: string | null) =>
  (g || "").replace(/[{}]/g, "").trim().toUpperCase();

export const obrasContratosService = {
  listarObras: () => request<ObraSelecao[]>("/obras/selecao"),

  listarContratos: () => request<Contrato[]>("/contratos"),

  listarVinculos: () => request<VinculoObraContrato[]>("/obras/associadas"),

  associar: (globalId: string, contratoId: number) =>
    request<{ sucesso: boolean; mensagem: string; vinculo: any }>("/associar", {
      method: "POST",
      body: JSON.stringify({ globalId, contratoId }),
    }),

  desassociar: (vinculoId: number) =>
    request<{ sucesso: boolean; mensagem: string }>(`/vinculos/${vinculoId}`, {
      method: "DELETE",
    }),
};
