// src/pages/GestaoObrasContratosPage.tsx
// Tela de associação Obras x Contratos (uma obra pode ter vários contratos)
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent, KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  obrasContratosService,
  normalizarGuid,
  type Contrato,
  type ObraSelecao,
  type VinculoObraContrato,
} from "../services/obrasContratosService";
import {
  useAuthStore,
  canUserEdit,
  formatRoleLabel,
} from "../core/authStore";
import {
  formatDateUtcPtBr,
  formatCurrencyBrl,
  removeAccents,
} from "../utils/formatters";
import "./GestaoObrasContratosPage.css";

const classeStatusObra = (status?: string) => {
  const s = removeAccents(status);
  if (s.includes("andamento")) return "is-andamento";
  if (s.includes("finaliz") || s.includes("conclu")) return "is-finalizada";
  if (s.includes("paralis") || s.includes("suspens")) return "is-paralisada";
  return "is-cadastrada";
};

const classeSituacao = (sit?: string) => {
  const s = removeAccents(sit);
  if (s.includes("ativo")) return "is-ativo";
  if (s.includes("encerr") || s.includes("rescin")) return "is-encerrado";
  return "is-neutro";
};

type Toast = { id: number; tipo: "sucesso" | "erro"; msg: string };

const MAX_SUGESTOES = 50;

export default function GestaoObrasContratosPage() {
  const navigate = useNavigate();

  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const podeEditar = canUserEdit(user);

  const [obras, setObras] = useState<ObraSelecao[]>([]);
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [vinculos, setVinculos] = useState<VinculoObraContrato[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState<string | null>(null);

  const [obraAtivaId, setObraAtivaId] = useState<string | null>(null);
  const [filtroObras, setFiltroObras] = useState("");

  const [busca, setBusca] = useState("");
  const [contratoSel, setContratoSel] = useState<Contrato | null>(null);
  const [sugestoesAbertas, setSugestoesAbertas] = useState(false);
  const [indiceDestaque, setIndiceDestaque] = useState(0);

  const [salvando, setSalvando] = useState(false);
  const [removendoId, setRemovendoId] = useState<number | null>(null);
  const [confirmarId, setConfirmarId] = useState<number | null>(null);

  const [toasts, setToasts] = useState<Toast[]>([]);
  const buscaWrapRef = useRef<HTMLDivElement>(null);
  const toastTimersRef = useRef<number[]>([]);

  useEffect(() => {
    return () => {
      toastTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
      toastTimersRef.current = [];
    };
  }, []);

  const notificar = useCallback((tipo: Toast["tipo"], msg: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, tipo, msg }]);
    const timerId = window.setTimeout(() => {
      setToasts((t) => t.filter((x) => x.id !== id));
      toastTimersRef.current = toastTimersRef.current.filter((tId) => tId !== timerId);
    }, 4000);
    toastTimersRef.current.push(timerId);
  }, []);

  /* ---------- Carga inicial ---------- */
  const carregarTudo = useCallback(async () => {
    setCarregando(true);
    setErroCarga(null);
    try {
      const [o, c, v] = await Promise.all([
        obrasContratosService.listarObras(),
        obrasContratosService.listarContratos(),
        obrasContratosService.listarVinculos(),
      ]);
      setObras(o || []);
      setContratos(c || []);
      setVinculos(v || []);
      setObraAtivaId((atual) => atual ?? (o?.[0] ? normalizarGuid(o[0].GlobalId) : null));
    } catch (e: any) {
      setErroCarga(e?.message || "Falha ao carregar dados.");
    } finally {
      setCarregando(false);
    }
  }, []);

  const recarregarVinculos = useCallback(async () => {
    const v = await obrasContratosService.listarVinculos();
    setVinculos(v || []);
  }, []);

  useEffect(() => {
    carregarTudo();
  }, [carregarTudo]);

  /* ---------- Fechar sugestões ao clicar fora ---------- */
  useEffect(() => {
    const onClick = (ev: MouseEvent) => {
      if (buscaWrapRef.current && !buscaWrapRef.current.contains(ev.target as Node)) {
        setSugestoesAbertas(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  /* ---------- Derivados ---------- */
  const vinculosPorObra = useMemo(() => {
    const mapa = new Map<string, VinculoObraContrato[]>();
    for (const v of vinculos) {
      const k = normalizarGuid(v.GlobalId);
      if (!mapa.has(k)) mapa.set(k, []);
      mapa.get(k)!.push(v);
    }
    return mapa;
  }, [vinculos]);

  const obrasFiltradas = useMemo(() => {
    const q = removeAccents(filtroObras.trim());
    if (!q) return obras;
    return obras.filter(
      (o) => removeAccents(o.NomeObra).includes(q) || removeAccents(o.Status).includes(q)
    );
  }, [obras, filtroObras]);

  const obraAtiva = useMemo(
    () => obras.find((o) => normalizarGuid(o.GlobalId) === obraAtivaId) || null,
    [obras, obraAtivaId]
  );

  const vinculosObraAtiva = useMemo(
    () => (obraAtivaId ? vinculosPorObra.get(obraAtivaId) || [] : []),
    [vinculosPorObra, obraAtivaId]
  );

  const sugestoes = useMemo(() => {
    const jaVinculados = new Set(vinculosObraAtiva.map((v) => v.ContratoId));
    const q = removeAccents(busca.trim());
    const disponiveis = contratos.filter((c) => !jaVinculados.has(c.ContratoId));
    const filtrados = q
      ? disponiveis.filter((c) =>
          [c.NumeroContrato, c.NumeroEdital, c.NumeroProcesso, c.ObjetoContratacao]
            .some((campo) => removeAccents(campo).includes(q))
        )
      : disponiveis;
    return filtrados.slice(0, MAX_SUGESTOES);
  }, [contratos, vinculosObraAtiva, busca]);

  /* ---------- Ações ---------- */
  const selecionarObra = (globalId: string) => {
    setObraAtivaId(normalizarGuid(globalId));
    setBusca("");
    setContratoSel(null);
    setConfirmarId(null);
  };

  const escolherContrato = (c: Contrato) => {
    setContratoSel(c);
    setBusca(`${c.NumeroContrato}${c.NumeroEdital ? ` — Edital ${c.NumeroEdital}` : ""}`);
    setSugestoesAbertas(false);
  };

  const onBuscaKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!sugestoesAbertas && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setSugestoesAbertas(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceDestaque((i) => Math.min(i + 1, sugestoes.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceDestaque((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && sugestoesAbertas && sugestoes[indiceDestaque]) {
      e.preventDefault();
      escolherContrato(sugestoes[indiceDestaque]);
    } else if (e.key === "Escape") {
      setSugestoesAbertas(false);
    }
  };

  const vincular = async (e: FormEvent) => {
    e.preventDefault();
    if (!obraAtiva || !contratoSel) {
      notificar("erro", "Selecione um contrato da lista para vincular.");
      return;
    }
    setSalvando(true);
    try {
      await obrasContratosService.associar(obraAtiva.GlobalId, contratoSel.ContratoId);
      await recarregarVinculos();
      notificar("sucesso", `Contrato ${contratoSel.NumeroContrato} vinculado à obra.`);
      setBusca("");
      setContratoSel(null);
    } catch (err: any) {
      notificar("erro", err?.message || "Falha ao vincular contrato.");
    } finally {
      setSalvando(false);
    }
  };

  const desvincular = async (v: VinculoObraContrato) => {
    setRemovendoId(v.VinculoId);
    try {
      await obrasContratosService.desassociar(v.VinculoId);
      setVinculos((lista) => lista.filter((x) => x.VinculoId !== v.VinculoId));
      notificar("sucesso", `Contrato ${v.NumeroContrato} desvinculado.`);
    } catch (err: any) {
      notificar("erro", err?.message || "Falha ao desvincular contrato.");
    } finally {
      setRemovendoId(null);
      setConfirmarId(null);
    }
  };

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <div className="goc-page">
      <header className="goc-topbar">
        <div className="goc-brand">
          <button
            type="button"
            id="btnVoltarMapa"
            className="goc-icon-btn"
            onClick={() => navigate("/")}
            title="Voltar ao mapa"
            aria-label="Voltar ao mapa"
          >
            <i className="fa-solid fa-arrow-left" />
          </button>
          <span className="goc-logo">obras360</span>
          <span className="goc-brand-sep">·</span>
          <h1>Gestão de Contratos e Obras</h1>
        </div>

        <div className="goc-topbar-actions">
          {user && (
            <div className="goc-user-chip" title={`Login AD: ${user.login}`}>
              <i className="fa-solid fa-user-shield" />
              <span className="goc-user-name">
                {user.nome_completo || user.login}
              </span>
              <span className={`goc-role-badge role-${user.role}`}>
                {formatRoleLabel(user.role)}
              </span>
            </div>
          )}

          <button
            type="button"
            id="btnRecarregar"
            className="goc-icon-btn"
            onClick={carregarTudo}
            disabled={carregando}
            title="Recarregar dados"
            aria-label="Recarregar dados"
          >
            <i className={`fa-solid fa-rotate-right ${carregando ? "fa-spin" : ""}`} />
          </button>

          <button
            type="button"
            id="btnSair"
            className="goc-logout-btn"
            onClick={handleLogout}
            title="Encerrar sessão"
            aria-label="Encerrar sessão"
          >
            <i className="fa-solid fa-right-from-bracket" />
            <span>Sair</span>
          </button>
        </div>
      </header>

      {erroCarga && (
        <div className="goc-alert" role="alert">
          <i className="fa-solid fa-triangle-exclamation" />
          <span>{erroCarga}</span>
          <button type="button" onClick={carregarTudo}>Tentar novamente</button>
        </div>
      )}

      <div className="gestao-container">
        {/* ========== Seção 1: Seleção da Obra ========== */}
        <section className="painel-obras" aria-labelledby="tituloObras">
          <h2 id="tituloObras">
            Obras Cadastradas <span className="goc-count">{obras.length}</span>
          </h2>

          <div className="goc-input-icon">
            <i className="fa-solid fa-magnifying-glass" />
            <input
              type="text"
              id="filtroObras"
              placeholder="Filtrar obra por nome ou status..."
              value={filtroObras}
              onChange={(e) => setFiltroObras(e.target.value)}
            />
          </div>

          <div className="lista-obras" role="listbox" aria-label="Obras">
            {carregando &&
              Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="obra-card is-skeleton" />
              ))}

            {!carregando && obrasFiltradas.length === 0 && (
              <p className="goc-empty-sm">Nenhuma obra encontrada.</p>
            )}

            {!carregando &&
              obrasFiltradas.map((o) => {
                const id = normalizarGuid(o.GlobalId);
                const qtd = vinculosPorObra.get(id)?.length || 0;
                const ativa = id === obraAtivaId;
                return (
                  <button
                    key={o.GlobalId}
                    id={`obra-${id}`}
                    type="button"
                    role="option"
                    aria-selected={ativa}
                    className={`obra-card ${ativa ? "active" : ""}`}
                    data-globalid={o.GlobalId}
                    onClick={() => selecionarObra(o.GlobalId)}
                  >
                    <div className="obra-card-top">
                      <strong>{o.NomeObra || "Obra sem nome"}</strong>
                      <span className={`goc-badge ${classeStatusObra(o.Status)}`}>
                        {o.Status || "—"}
                      </span>
                    </div>
                    <span className="obra-card-guid">{id}</span>
                    <span className="obra-card-meta">
                      <i className="fa-solid fa-file-contract" />
                      {qtd === 0
                        ? "Nenhum contrato vinculado"
                        : `${qtd} contrato${qtd > 1 ? "s" : ""} vinculado${qtd > 1 ? "s" : ""}`}
                    </span>
                  </button>
                );
              })}
          </div>
        </section>

        {/* ========== Seção 2: Associação ========== */}
        <section className="painel-associacao" aria-labelledby="tituloAssociacao">
          {!obraAtiva ? (
            <div className="goc-empty">
              <i className="fa-solid fa-hand-pointer" />
              <p>Selecione uma obra à esquerda para gerenciar seus contratos.</p>
            </div>
          ) : (
            <>
              <header className="goc-assoc-header">
                <h2 id="tituloAssociacao">
                  Contratos da Obra:{" "}
                  <span id="nomeObraSelecionada">{obraAtiva.NomeObra}</span>
                </h2>
                <span className={`goc-badge ${classeStatusObra(obraAtiva.Status)}`}>
                  {obraAtiva.Status}
                </span>
              </header>

              {/* Formulário de associação (somente admin e editor) */}
              {podeEditar ? (
                <form id="formAssociar" className="goc-card formulario-vinculo" onSubmit={vincular}>
                  <label htmlFor="buscaContrato">
                    Pesquisar contrato (Nº, Edital, Processo ou Objeto)
                  </label>
                  <div className="linha-input">
                    <div className="goc-autocomplete" ref={buscaWrapRef}>
                      <div className="goc-input-icon">
                        <i className="fa-solid fa-magnifying-glass" />
                        <input
                          id="buscaContrato"
                          type="text"
                          placeholder="Ex: 01 00939/2024 ou 090420/2024..."
                          autoComplete="off"
                          role="combobox"
                          aria-expanded={sugestoesAbertas}
                          aria-controls="listaContratos"
                          value={busca}
                          onChange={(e) => {
                            setBusca(e.target.value);
                            setContratoSel(null);
                            setSugestoesAbertas(true);
                            setIndiceDestaque(0);
                          }}
                          onFocus={() => setSugestoesAbertas(true)}
                          onKeyDown={onBuscaKeyDown}
                        />
                        {busca && (
                          <button
                            type="button"
                            className="goc-clear"
                            aria-label="Limpar busca"
                            onClick={() => {
                              setBusca("");
                              setContratoSel(null);
                            }}
                          >
                            <i className="fa-solid fa-xmark" />
                          </button>
                        )}
                      </div>

                      {sugestoesAbertas && (
                        <ul id="listaContratos" className="goc-sugestoes" role="listbox">
                          {sugestoes.length === 0 ? (
                            <li className="goc-sugestao-vazia">
                              Nenhum contrato disponível para esta busca.
                            </li>
                          ) : (
                            sugestoes.map((c, i) => (
                              <li
                                key={c.ContratoId}
                                id={`sugestao-${c.ContratoId}`}
                                role="option"
                                aria-selected={i === indiceDestaque}
                                data-id={c.ContratoId}
                                className={i === indiceDestaque ? "is-highlight" : ""}
                                onMouseEnter={() => setIndiceDestaque(i)}
                                onMouseDown={(e) => {
                                  e.preventDefault();
                                  escolherContrato(c);
                                }}
                              >
                                <div className="goc-sug-linha1">
                                  <strong>{c.NumeroContrato}</strong>
                                  <span className={`goc-badge sm ${classeSituacao(c.SituacaoDescricao)}`}>
                                    {c.SituacaoDescricao || "—"}
                                  </span>
                                </div>
                                <div className="goc-sug-linha2">
                                  {c.NumeroEdital && <span>Edital {c.NumeroEdital}</span>}
                                  {c.ObjetoContratacao && (
                                    <span className="goc-sug-objeto">{c.ObjetoContratacao}</span>
                                  )}
                                </div>
                              </li>
                            ))
                          )}
                        </ul>
                      )}
                    </div>

                    <button
                      type="submit"
                      id="btnVincular"
                      className="btn-adicionar"
                      disabled={!contratoSel || salvando}
                    >
                      {salvando ? (
                        <i className="fa-solid fa-spinner fa-spin" />
                      ) : (
                        <i className="fa-solid fa-link" />
                      )}
                      Vincular
                    </button>
                  </div>
                </form>
              ) : (
                <div className="goc-readonly-banner" role="status">
                  <i className="fa-solid fa-eye" />
                  <span>
                    <strong>Modo Somente Leitura</strong> — Seu perfil (
                    {formatRoleLabel(user?.role)}) permite visualizar obras e contratos
                    vinculados, sem permissão para vincular ou desvincular.
                  </span>
                </div>
              )}

              {/* Tabela de vinculados */}
              <div className="goc-card">
                <div className="goc-card-head">
                  <h3>Contratos já vinculados</h3>
                  <span className="goc-count">{vinculosObraAtiva.length}</span>
                </div>

                {vinculosObraAtiva.length === 0 ? (
                  <div className="goc-empty sm">
                    <i className="fa-regular fa-folder-open" />
                    <p>Esta obra ainda não possui contratos vinculados.</p>
                  </div>
                ) : (
                  <div className="goc-table-wrap">
                    <table className="tabela-vinculados">
                      <thead>
                        <tr>
                          <th>Nº Contrato</th>
                          <th>Edital</th>
                          <th>Objeto</th>
                          <th>Vigência</th>
                          <th className="num">Saldo</th>
                          <th>Situação</th>
                          {podeEditar && <th className="acoes">Ações</th>}
                        </tr>
                      </thead>
                      <tbody id="corpoTabelaVinculos">
                        {vinculosObraAtiva.map((v) => (
                          <tr key={v.VinculoId}>
                            <td className="mono">{v.NumeroContrato}</td>
                            <td className="mono">{v.NumeroEdital || "—"}</td>
                            <td className="objeto" title={v.ObjetoContratacao}>
                              {v.ObjetoContratacao || "—"}
                            </td>
                            <td className="nowrap">
                              {formatDateUtcPtBr(v.DataInicio)} – {formatDateUtcPtBr(v.DataTerminoAtualizada || v.DataTerminoVigencia)}
                            </td>
                            <td className="num nowrap">{formatCurrencyBrl(v.ValorSaldo, "—")}</td>
                            <td>
                              <span className={`goc-badge sm ${classeSituacao(v.SituacaoContratoDescricao)}`}>
                                {v.SituacaoContratoDescricao || "—"}
                              </span>
                            </td>
                            {podeEditar && (
                              <td className="acoes">
                                {confirmarId === v.VinculoId ? (
                                  <div className="goc-confirm">
                                    <button
                                      type="button"
                                      id={`btnConfirmar-${v.VinculoId}`}
                                      className="btn-confirmar"
                                      disabled={removendoId === v.VinculoId}
                                      onClick={() => desvincular(v)}
                                    >
                                      {removendoId === v.VinculoId ? (
                                        <i className="fa-solid fa-spinner fa-spin" />
                                      ) : (
                                        "Confirmar"
                                      )}
                                    </button>
                                    <button
                                      type="button"
                                      className="btn-cancelar"
                                      onClick={() => setConfirmarId(null)}
                                    >
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    type="button"
                                    id={`btnRemover-${v.VinculoId}`}
                                    className="btn-remover"
                                    data-vinculoid={v.VinculoId}
                                    onClick={() => setConfirmarId(v.VinculoId)}
                                  >
                                    <i className="fa-regular fa-trash-can" />
                                    Desvincular
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Toasts */}
      <div className="goc-toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={`goc-toast is-${t.tipo}`}>
            <i
              className={`fa-solid ${t.tipo === "sucesso" ? "fa-circle-check" : "fa-circle-exclamation"}`}
            />
            <span>{t.msg}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
