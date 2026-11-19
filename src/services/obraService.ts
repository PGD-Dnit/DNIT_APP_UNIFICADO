// src/services/obraService.ts
import { apiRequest } from "../core/apiClient";

export interface ObraRegistroBanco {
  GlobalId: string;
  IdFeature: string;
  ObjectId: number;
  NomeObra: string;
  Status: string;
  DataCriacao?: string;
  DataAtualizacao?: string;
  IdVinculoContrato?: number;
  ContratoId?: number;
  DataVinculo?: string;
  IdRegistroFeature?: number;
  NomeCamada?: string;
  DataCarga?: string;
  NumeroContrato?: string;
  ObjetoContratacao?: string;
  ModalidadeLicitacao?: string;
  Programa?: string;
  DataInicio?: string;
  DataTerminoVigencia?: string;
  DataTerminoAtualizada?: string;
  ValorInicial?: number;
  ValorInicialAditivo?: number;
  ValorInicialAditivosReajuste?: number;
  ValorTotalReajuste?: number;
  ValorSaldo?: number;
}

export interface ObraRegistroArcgis {
  nome_obra?: string;
  globalid?: string;
  objectid?: number;
  status?: string;
  [key: string]: any;
}

export interface ArcgisCamada {
  id: string;
  title: string;
  featureUrl: string;
  fields?: any[];
  totalRegistros: number;
  registros: ObraRegistroArcgis[];
  erro?: string | null;
}

export interface ConsultaObraResponse {
  globalid: string;
  globalidFormatadoDB: string;
  arcgis: {
    sucesso: boolean;
    erro: string | null;
    camadas: ArcgisCamada[];
  };
  banco: {
    sucesso: boolean;
    procedure: string;
    erro: string | null;
    totalRegistros: number;
    registros: ObraRegistroBanco[];
  };
}

/**
 * Consulta os detalhes completos da obra no backend (combinando ArcGIS e Banco de Dados)
 * @param id ID do Feature / Camada
 * @param globalid GUID da obra (ex: {141F67C9-FA68-4B2C-ADF2-B6303E39CA87})
 */
export async function consultarObra(
  id: string,
  globalid: string
): Promise<ConsultaObraResponse> {
  return apiRequest<ConsultaObraResponse>(
    `/features-obras/consultaObra?id=${encodeURIComponent(id)}&globalid=${encodeURIComponent(globalid)}`
  );
}
