import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcularNivelAlerta, formatarMoeda, nomeSecretaria, titleCase } from '../utils/statusUtils';
import type { NivelAlerta } from '../utils/statusUtils';
import '../components/Table.css';
import '../components/Badge.css';

interface Contrato {
  id: string;
  numero_contrato: string;
  fornecedor: string;
  objeto: string;
  valor_total: number;
  data_inicio: string;
  data_vencimento: string;
  data_publicacao_pncp?: string | null;
  tipo_objeto?: string | null;
  status: string;
  secretaria_id?: string | null;
  secretarias?: { id: string; nome: string } | null;
}

const LIMITE_OBRAS = 100_000;
const LIMITE_OUTROS = 50_000;
const anoAtual = new Date().getFullYear();

function limiteParaTipo(tipo: string | null | undefined): number {
  return tipo === 'obra' ? LIMITE_OBRAS : LIMITE_OUTROS;
}

function labelTipo(tipo: string | null | undefined): string {
  if (tipo === 'obra') return 'Obras / Engenharia';
  if (tipo === 'compra') return 'Compras';
  return 'Serviços';
}

function addWorkingDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

function workingDaysDiff(from: Date, to: Date): number {
  let count = 0;
  const cur = new Date(from);
  while (cur < to) {
    const dow = cur.getDay();
    if (dow !== 0 && dow !== 6) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

interface DispensaRow {
  secretariaNome: string;
  tipoObjeto: string | null;
  totalAno: number;
  limite: number;
}

interface PendenciaPNCP {
  contrato: Contrato;
  diasUteisSemPublicar: number;
  prazoFinal: Date;
  atrasado: boolean;
}

interface ContratoCalendario {
  contrato: Contrato;
  nivelAlerta: NivelAlerta;
  dataRecomendada: Date;
  diasRestantes: number;
}

export const Conformidade: React.FC = () => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [loading, setLoading] = useState(true);
  const [numeroBusca, setNumeroBusca] = useState('');
  const [fornecedorFiltro, setFornecedorFiltro] = useState('');
  const [dataInicioDe, setDataInicioDe] = useState('');
  const [dataInicioAte, setDataInicioAte] = useState('');
  const [filtroAberto, setFiltroAberto] = useState<string | null>(null);

  const truncate = (str: string, max = 38) =>
    str.length > max ? str.slice(0, max) + '…' : str;

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('contratos')
        .select('*, secretarias(id, nome)')
        .order('data_vencimento', { ascending: true });
      setContratos(data || []);
      setLoading(false);
    })();
  }, []);

  const fornecedoresUnicos = useMemo(() =>
    Array.from(new Set(contratos.map(c => c.fornecedor))).sort()
  , [contratos]);

  const contratosFiltrados = useMemo(() => {
    let result = contratos;
    if (numeroBusca.trim()) result = result.filter(c => c.numero_contrato.toLowerCase().includes(numeroBusca.toLowerCase()));
    if (fornecedorFiltro) result = result.filter(c => c.fornecedor === fornecedorFiltro);
    if (dataInicioDe) result = result.filter(c => c.data_inicio && c.data_inicio >= dataInicioDe);
    if (dataInicioAte) result = result.filter(c => c.data_inicio && c.data_inicio <= dataInicioAte);
    return result;
  }, [contratos, numeroBusca, fornecedorFiltro, dataInicioDe, dataInicioAte]);

  const hoje = new Date();

  const pendenciasPNCP: PendenciaPNCP[] = contratosFiltrados
    .filter(c => !c.data_publicacao_pncp && c.data_inicio)
    .map(c => {
      const inicio = new Date(c.data_inicio + 'T12:00:00');
      const prazoFinal = addWorkingDays(inicio, 20);
      const diasUteisSemPublicar = workingDaysDiff(inicio, hoje);
      return { contrato: c, diasUteisSemPublicar, prazoFinal, atrasado: hoje > prazoFinal };
    })
    .filter(p => p.diasUteisSemPublicar > 0)
    .sort((a, b) => Number(b.atrasado) - Number(a.atrasado));

  const dispMap = new Map<string, DispensaRow>();
  contratosFiltrados.forEach(c => {
    if (!c.data_inicio) return;
    const anoContrato = new Date(c.data_inicio + 'T12:00:00').getFullYear();
    if (anoContrato !== anoAtual) return;
    const secNome = c.secretarias?.nome || 'Sem Secretaria';
    const tipo = c.tipo_objeto || 'servico';
    const chave = `${secNome}||${tipo}`;
    if (!dispMap.has(chave)) dispMap.set(chave, { secretariaNome: secNome, tipoObjeto: tipo, totalAno: 0, limite: limiteParaTipo(tipo) });
    dispMap.get(chave)!.totalAno += c.valor_total || 0;
  });

  const linhasDispensa = Array.from(dispMap.values()).sort((a, b) => (b.totalAno / b.limite) - (a.totalAno / a.limite));

  const calendarioLicitacoes: ContratoCalendario[] = contratosFiltrados
    .filter(c => {
      if (!c.data_vencimento) return false;
      const nivel = calcularNivelAlerta(c.data_vencimento, c.status as any);
      return nivel === 'planejamento' || nivel === 'atencao';
    })
    .map(c => {
      const venc = new Date(c.data_vencimento + 'T12:00:00');
      const dataRecomendada = new Date(venc);
      dataRecomendada.setDate(dataRecomendada.getDate() - 180);
      const diasRestantes = Math.ceil((venc.getTime() - hoje.getTime()) / 86400000);
      return { contrato: c, nivelAlerta: calcularNivelAlerta(c.data_vencimento, c.status as any), dataRecomendada, diasRestantes };
    })
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  if (loading) return <div className="page-header"><h1 className="page-title">Carregando...</h1></div>;

  return (
    <div className="fade-in">
      <div className="page-header">
        <div>
          <h1 className="page-title">Conformidade</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', marginTop: '0.25rem' }}>Exigências da Lei 14.133/2021</p>
        </div>
      </div>

      {filtroAberto && <div style={{ position: 'fixed', inset: 0, zIndex: 9 }} onClick={() => setFiltroAberto(null)} />}

      {/* ── SEÇÃO A: Publicação PNCP ─────────────────────────────────────── */}
      <section className="secao">
        <h2 className="secao-titulo">Publicação no PNCP</h2>
        <p className="secao-sub">Art. 94, prazo de 20 dias úteis.</p>

        {pendenciasPNCP.length === 0 ? (
          <p className="secao-vazia">
            Todos os contratos com data de início registrada já possuem data de publicação no PNCP.
          </p>
        ) : (
          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  <th style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="th-filtro"
                      aria-expanded={filtroAberto === 'numero'}
                      onClick={e => { e.stopPropagation(); setFiltroAberto(f => f === 'numero' ? null : 'numero'); }}
                    >
                      Contrato {numeroBusca && <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>●</span>} ▾
                    </button>
                    {filtroAberto === 'numero' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', boxShadow: 'var(--shadow-md)', minWidth: '180px' }} onClick={e => e.stopPropagation()}>
                        <input autoFocus className="form-input" style={{ height: '32px', fontSize: '0.8rem' }} placeholder="Buscar número..." value={numeroBusca} onChange={e => setNumeroBusca(e.target.value)} />
                        {numeroBusca && <button style={{ marginTop: '0.3rem', fontSize: '0.75rem', color: 'var(--red)', cursor: 'pointer', background: 'none', border: 'none' }} onClick={() => setNumeroBusca('')}>Limpar</button>}
                      </div>
                    )}
                  </th>
                  <th style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="th-filtro"
                      aria-expanded={filtroAberto === 'fornecedor'}
                      onClick={e => { e.stopPropagation(); setFiltroAberto(f => f === 'fornecedor' ? null : 'fornecedor'); }}
                    >
                      Fornecedor {fornecedorFiltro && <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>●</span>} ▾
                    </button>
                    {filtroAberto === 'fornecedor' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-md)', maxHeight: '240px', overflowY: 'auto', minWidth: '260px' }} onClick={e => e.stopPropagation()}>
                        <div style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', color: !fornecedorFiltro ? 'var(--accent)' : 'var(--text-mid)', fontWeight: !fornecedorFiltro ? 600 : 400 }} onClick={() => { setFornecedorFiltro(''); setFiltroAberto(null); }}>Todos</div>
                        {fornecedoresUnicos.map(f => (
                          <div key={f} style={{ padding: '0.5rem 0.75rem', cursor: 'pointer', fontSize: '0.82rem', background: fornecedorFiltro === f ? 'var(--accent-dim)' : 'transparent', color: fornecedorFiltro === f ? 'var(--accent)' : 'var(--text-high)', fontWeight: fornecedorFiltro === f ? 600 : 400 }} onClick={() => { setFornecedorFiltro(f); setFiltroAberto(null); }}>
                            {truncate(titleCase(f), 40)}
                          </div>
                        ))}
                      </div>
                    )}
                  </th>
                  <th style={{ position: 'relative' }}>
                    <button
                      type="button"
                      className="th-filtro"
                      aria-expanded={filtroAberto === 'data'}
                      onClick={e => { e.stopPropagation(); setFiltroAberto(f => f === 'data' ? null : 'data'); }}
                    >
                      Início {(dataInicioDe || dataInicioAte) && <span style={{ color: 'var(--accent)', fontSize: '0.65rem' }}>●</span>} ▾
                    </button>
                    {filtroAberto === 'data' && (
                      <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '0.75rem', boxShadow: 'var(--shadow-md)', minWidth: '260px', display: 'flex', flexDirection: 'column', gap: '0.5rem' }} onClick={e => e.stopPropagation()}>
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-mid)' }}>De</label>
                        <input type="date" className="form-input" style={{ height: '32px', fontSize: '0.8rem' }} value={dataInicioDe} onChange={e => setDataInicioDe(e.target.value)} />
                        <label style={{ fontSize: '0.75rem', color: 'var(--text-mid)' }}>Até</label>
                        <input type="date" className="form-input" style={{ height: '32px', fontSize: '0.8rem' }} value={dataInicioAte} onChange={e => setDataInicioAte(e.target.value)} />
                        {(dataInicioDe || dataInicioAte) && <button style={{ fontSize: '0.75rem', color: 'var(--red)', cursor: 'pointer', background: 'none', border: 'none', textAlign: 'left' }} onClick={() => { setDataInicioDe(''); setDataInicioAte(''); }}>Limpar</button>}
                      </div>
                    )}
                  </th>
                  <th>Prazo limite</th>
                  <th>Dias úteis sem publicar</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pendenciasPNCP.map(({ contrato: c, diasUteisSemPublicar, prazoFinal, atrasado }) => (
                  <tr key={c.id} className="clickable-row" onClick={() => navigate(`/contrato/${c.id}`)}>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{c.numero_contrato}</td>
                    <td><Link className="link-linha" to={`/contrato/${c.id}`} onClick={e => e.stopPropagation()}>{titleCase(c.fornecedor)}</Link></td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{new Date(c.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{prazoFinal.toLocaleDateString('pt-BR')}</td>
                    <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 600, color: atrasado ? 'var(--red)' : 'var(--amber)' }}>
                      {diasUteisSemPublicar}
                    </td>
                    <td>
                      {atrasado
                        ? <span className="badge badge-vencido">Atrasado</span>
                        : <span className="badge badge-vencendo">Pendente</span>
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SEÇÃO B: Limite de Dispensa ──────────────────────────────────── */}
      <section className="secao">
        <h2 className="secao-titulo">Limite de dispensa de licitação</h2>
        <p className="secao-sub">
          Art. 75, exercício {anoAtual}. Limite anual por unidade gestora e objeto de mesma natureza:
          R$&nbsp;100.000 para obras e R$&nbsp;50.000 para serviços e compras. Reinicia em 1º de janeiro.
        </p>

        {linhasDispensa.length === 0 ? (
          <p className="secao-vazia">Nenhum contrato com data de início em {anoAtual}.</p>
        ) : (
          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  {['Secretaria', 'Tipo de objeto', 'Contratado no ano', 'Limite legal', 'Saldo', 'Consumo'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {linhasDispensa.map((row, i) => {
                  const perc = Math.min((row.totalAno / row.limite) * 100, 100);
                  const percReal = (row.totalAno / row.limite) * 100;
                  const saldo = row.limite - row.totalAno;
                  const barColor = percReal >= 80 ? 'var(--red)' : percReal >= 50 ? 'var(--amber)' : 'var(--green)';
                  const alertaColor = percReal >= 100 ? 'var(--red)' : percReal >= 50 ? 'var(--amber)' : 'var(--green)';
                  const alertaDim = percReal >= 100 ? 'var(--red-dim)' : percReal >= 50 ? 'var(--amber-dim)' : 'var(--green-dim)';
                  const alertaBorder = percReal >= 100 ? 'var(--red-border)' : percReal >= 50 ? 'var(--amber-border)' : 'var(--green-border)';
                  const alertaLabel = percReal >= 100 ? 'Limite atingido' : percReal >= 80 ? 'Atenção' : percReal >= 50 ? 'Moderado' : 'OK';

                  return (
                    <tr key={i}>
                      <td style={{ fontWeight: 500 }}>{nomeSecretaria(row.secretariaNome)}</td>
                      <td style={{ color: 'var(--text-mid)', fontSize: '0.8125rem' }}>{labelTipo(row.tipoObjeto)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600 }}>{formatarMoeda(row.totalAno)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{formatarMoeda(row.limite)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: saldo < 0 ? 'var(--red)' : 'var(--text-high)' }}>
                        {saldo < 0 ? `−${formatarMoeda(Math.abs(saldo))}` : formatarMoeda(saldo)}
                      </td>
                      <td style={{ minWidth: 180 }}>
                        <div style={{ height: 6, borderRadius: 3, backgroundColor: 'var(--bg-muted)', overflow: 'hidden', marginBottom: '0.375rem' }}>
                          <div style={{ height: '100%', width: `${perc}%`, backgroundColor: barColor, borderRadius: 3, transition: 'width 0.3s ease' }} />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--text-low)', fontFamily: 'var(--font-mono)' }}>{percReal.toFixed(1)}%</span>
                          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: alertaColor, backgroundColor: alertaDim, border: `1px solid ${alertaBorder}`, padding: '0.125rem 0.375rem', borderRadius: '4px',  }}>{alertaLabel}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* ── SEÇÃO C: Calendário de Licitações ────────────────────────────── */}
      <section className="secao">
        <h2 className="secao-titulo">Calendário de licitações</h2>
        <p className="secao-sub">
          Contratos em atenção ou planejamento. A licitação deve começar até 180 dias antes do vencimento.
        </p>

        {calendarioLicitacoes.length === 0 ? (
          <p className="secao-vazia">
            Nenhum contrato requer planejamento licitatório imediato.
          </p>
        ) : (
          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  {['Contrato', 'Fornecedor', 'Secretaria', 'Vencimento', 'Iniciar licitação até', 'Dias restantes', 'Nível'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {calendarioLicitacoes.map(({ contrato: c, nivelAlerta, dataRecomendada, diasRestantes }) => {
                  const dataRecAtrasada = dataRecomendada < hoje;
                  return (
                    <tr key={c.id} className="clickable-row" onClick={() => navigate(`/contrato/${c.id}`)}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{c.numero_contrato}</td>
                      <td><Link className="link-linha" to={`/contrato/${c.id}`} onClick={e => e.stopPropagation()}>{titleCase(c.fornecedor)}</Link></td>
                      <td style={{ color: 'var(--text-mid)', fontSize: '0.8125rem' }}>{nomeSecretaria(c.secretarias?.nome)}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem' }}>{new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}</td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: dataRecAtrasada ? 'var(--red)' : 'var(--text-high)' }}>
                        {dataRecomendada.toLocaleDateString('pt-BR')}
                        {dataRecAtrasada && <AlertTriangle size={12} style={{ display: 'inline', marginLeft: '0.25rem', color: 'var(--red)', verticalAlign: 'middle' }} />}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', fontWeight: 600, color: diasRestantes <= 90 ? 'var(--amber)' : 'var(--text-high)' }}>
                        {diasRestantes} dias
                      </td>
                      <td>
                        <span className={`badge ${nivelAlerta === 'atencao' ? 'badge-vencendo' : 'badge-alerta-planejamento'}`}>
                          {nivelAlerta === 'atencao' ? 'Atenção' : 'Planejamento'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
