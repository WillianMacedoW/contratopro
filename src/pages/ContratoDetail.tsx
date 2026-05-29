import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, Trash2, ShieldCheck, ShieldX, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcularStatus, calcularNivelAlerta, formatarMoeda, formatarCNPJ, NIVEL_ALERTA_CONFIG } from '../utils/statusUtils';
import type { ContratoStatus } from '../utils/statusUtils';
import { Badge, BadgeAlerta } from '../components/Badge';

interface Contrato {
  id: string;
  fornecedor: string;
  fornecedor_cnpj?: string;
  fornecedor_situacao?: string;
  fornecedor_verificado_em?: string;
  objeto: string;
  numero_contrato: string;
  valor_total: number;
  data_inicio: string;
  data_vencimento: string;
  responsavel: string;
  status: ContratoStatus;
  tipo_objeto?: string;
  secretarias?: { nome: string } | null;
}

interface RegularidadeResult {
  receitaFederal: { razaoSocial: string; situacao: string; dataAbertura: string; erro?: string } | null;
  ceis: { total: number; sancoesAtivas: any[]; erro?: string } | null;
  cnep: { total: number; punicoesAtivas: any[]; erro?: string } | null;
}

export const ContratoDetail: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [loading, setLoading] = useState(true);
  const [verificando, setVerificando] = useState(false);
  const [regularidade, setRegularidade] = useState<RegularidadeResult | null>(null);
  const [cnpjTemp, setCnpjTemp] = useState('');

  useEffect(() => { fetchContrato(); }, [id]);

  const fetchContrato = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('contratos')
        .select('*, secretarias(nome)')
        .eq('id', id)
        .single();
      if (error) throw error;
      if (data) setContrato({ ...data, status: calcularStatus(data.data_vencimento, data.status) });
    } catch {
      alert('Contrato não encontrado.');
      navigate('/contratos');
    } finally {
      setLoading(false);
    }
  };

  const handleMarcarRenovado = async () => {
    if (!contrato) return;
    const { error } = await supabase.from('contratos').update({ status: 'renovado' }).eq('id', contrato.id);
    if (!error) setContrato({ ...contrato, status: 'renovado' });
  };

  const handleDelete = async () => {
    if (!contrato || !window.confirm('Deseja deletar este contrato?')) return;
    const { error } = await supabase.from('contratos').delete().eq('id', contrato.id);
    if (!error) navigate('/contratos');
  };

  const handleVerificarRegularidade = async () => {
    const cnpjExtraido = !contrato?.fornecedor_cnpj
      ? (contrato?.fornecedor?.match(/\((\d{14})\)/) || [])[1] || null
      : null;
    const cnpjRaw = contrato?.fornecedor_cnpj || cnpjExtraido || cnpjTemp;
    if (!cnpjRaw) return;
    const cnpj = cnpjRaw.replace(/\D/g, '');
    setVerificando(true);
    setRegularidade(null);

    const resultado: RegularidadeResult = { receitaFederal: null, ceis: null, cnep: null };

    // A) Receita Federal via cnpj.ws — campos estão em d.estabelecimento
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
      if (res.ok) {
        const d = await res.json();
        const est = d.estabelecimento || {};
        resultado.receitaFederal = {
          razaoSocial: d.razao_social || '',
          situacao: est.situacao_cadastral || '',
          dataAbertura: est.data_inicio_atividade || '',
        };
      } else {
        resultado.receitaFederal = { razaoSocial: '', situacao: '', dataAbertura: '', erro: `HTTP ${res.status}` };
      }
    } catch (e: any) {
      resultado.receitaFederal = { razaoSocial: '', situacao: '', dataAbertura: '', erro: e.message };
    }

    // B) CEIS e CNEP — Portal da Transparência (requer chave em VITE_TRANSPARENCIA_API_KEY)
    const transparenciaKey = import.meta.env.VITE_TRANSPARENCIA_API_KEY as string | undefined;
    const semChave = !transparenciaKey?.trim();

    try {
      if (semChave) throw new Error('Chave não configurada — registre em api.portaldatransparencia.gov.br e adicione em VITE_TRANSPARENCIA_API_KEY no .env');
      const res = await fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/ceis?cnpjSancionado=${cnpj}&pagina=1`, {
        headers: { 'chave-api-dados': transparenciaKey! }
      });
      if (res.ok) {
        const d = await res.json();
        const lista = Array.isArray(d) ? d : d.data || [];
        resultado.ceis = { total: lista.length, sancoesAtivas: lista.slice(0, 3) };
      } else {
        resultado.ceis = { total: 0, sancoesAtivas: [], erro: `HTTP ${res.status}` };
      }
    } catch (e: any) {
      resultado.ceis = { total: 0, sancoesAtivas: [], erro: e.message };
    }

    try {
      if (semChave) throw new Error('Chave não configurada — registre em api.portaldatransparencia.gov.br e adicione em VITE_TRANSPARENCIA_API_KEY no .env');
      const res = await fetch(`https://api.portaldatransparencia.gov.br/api-de-dados/cnep?cnpjSancionado=${cnpj}&pagina=1`, {
        headers: { 'chave-api-dados': transparenciaKey! }
      });
      if (res.ok) {
        const d = await res.json();
        const lista = Array.isArray(d) ? d : d.data || [];
        resultado.cnep = { total: lista.length, punicoesAtivas: lista.slice(0, 3) };
      } else {
        resultado.cnep = { total: 0, punicoesAtivas: [], erro: `HTTP ${res.status}` };
      }
    } catch (e: any) {
      resultado.cnep = { total: 0, punicoesAtivas: [], erro: e.message };
    }

    const situacaoRF = resultado.receitaFederal?.situacao?.toLowerCase() || '';
    const rfComProblema = situacaoRF.length > 0 && !situacaoRF.includes('ativa');
    const temProblemas =
      rfComProblema ||
      (resultado.ceis?.total || 0) > 0 ||
      (resultado.cnep?.total || 0) > 0;

    const situacao = temProblemas ? 'COM_RESTRICOES' : 'APTO';
    await supabase.from('contratos').update({
      fornecedor_situacao: situacao,
      fornecedor_verificado_em: new Date().toISOString(),
    }).eq('id', contrato!.id);

    setContrato(c => c ? { ...c, fornecedor_situacao: situacao, fornecedor_verificado_em: new Date().toISOString() } : c);
    setRegularidade(resultado);
    setVerificando(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: '32px', height: '32px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Carregando detalhes...</span>
    </div>
  );
  if (!contrato) return null;

  const nivel = calcularNivelAlerta(contrato.data_vencimento, contrato.status);
  const nivelCfg = NIVEL_ALERTA_CONFIG[nivel];

  const titleCase = (str: string) =>
    str.toLowerCase().replace(/\b(\p{L})/gu, l => l.toUpperCase());

  const cnpjExtraido = !contrato.fornecedor_cnpj
    ? (contrato.fornecedor.match(/\((\d{14})\)/) || [])[1] || null
    : null;
  const cnpjEfetivo = contrato.fornecedor_cnpj || cnpjExtraido;
  const cnpjFormatado = cnpjEfetivo ? formatarCNPJ(cnpjEfetivo) : null;
  const fornecedorNome = titleCase(contrato.fornecedor.replace(/\s*\(\d{14}\)\s*$/, '').trim());

  return (
    <div className="fade-in" style={{ maxWidth: '900px', margin: '0 auto' }}>
      {/* Header */}
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.5rem 0.625rem' }}>
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>Detalhes do Contrato</h1>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
              Nº {contrato.numero_contrato}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.625rem' }}>
          <button className="btn-secondary" onClick={() => navigate(`/contrato/${contrato.id}/editar`)}>
            <Edit size={16} /> Editar
          </button>
          <button
            className="btn-primary"
            style={{ background: contrato.status === 'renovado' ? 'var(--status-renovado-bg)' : undefined, color: contrato.status === 'renovado' ? 'var(--status-renovado-text)' : undefined }}
            onClick={handleMarcarRenovado}
            disabled={contrato.status === 'renovado'}
          >
            <CheckCircle size={16} /> {contrato.status === 'renovado' ? 'Renovado' : 'Marcar Renovado'}
          </button>
          <button
            className="btn-secondary"
            style={{ color: 'var(--status-vencido-text)', borderColor: 'var(--status-vencido-border)' }}
            onClick={handleDelete}
            title="Excluir contrato"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {/* Card principal — fornecedor + dados */}
      <div className="section-card" style={{ marginBottom: '1rem' }}>
        {/* Cabeçalho do card */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', paddingBottom: '1.25rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '0.25rem' }}>{fornecedorNome}</h2>
            {cnpjFormatado && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>
                CNPJ: <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{cnpjFormatado}</span>
              </p>
            )}
            {contrato.secretarias && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Secretaria: <span style={{ color: 'var(--text-primary)' }}>{contrato.secretarias.nome}</span>
              </p>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
            <Badge status={contrato.status} />
            <BadgeAlerta nivel={nivel} />
          </div>
        </div>

        {/* Alerta contextual */}
        {nivel !== 'ok' && nivel !== 'renovado' && (
          <div className="alert-banner" style={{
            backgroundColor: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : 'amber'}-dim)`,
            borderColor: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : 'amber'}-border)`,
          }}>
            <AlertCircle size={18} style={{ color: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : 'amber'})`, marginTop: '1px', flexShrink: 0 }} />
            <div>
              <p style={{ fontWeight: 600, color: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : 'amber'})`, fontSize: '0.875rem' }}>{nivelCfg.descricao}</p>
              <p style={{ fontSize: '0.8125rem', color: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : 'amber'})`, opacity: 0.85, marginTop: '0.125rem' }}>{nivelCfg.acao}</p>
            </div>
          </div>
        )}

        {/* Grid de campos */}
        <div className="info-grid">
          <div className="info-field">
            <label>Valor Total</label>
            <p style={{ fontSize: '1.375rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', fontWeight: 700, letterSpacing: '-0.02em' }}>{formatarMoeda(contrato.valor_total)}</p>
          </div>
          <div className="info-field">
            <label>Data Início</label>
            <p className="mono">{contrato.data_inicio ? new Date(contrato.data_inicio + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}</p>
          </div>
          <div className="info-field">
            <label>Data Vencimento</label>
            <p className="mono" style={{ color: `var(--${nivel === 'vencido' || nivel === 'critico' ? 'red' : nivel === 'ok' ? 'green' : 'amber'})`, fontWeight: 600 }}>
              {contrato.data_vencimento ? new Date(contrato.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
            </p>
          </div>
          <div className="info-field">
            <label>Responsável / Fiscal</label>
            <p style={{ color: contrato.responsavel ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>
              {contrato.responsavel || 'Não informado'}
            </p>
          </div>
          <div className="info-field" style={{ gridColumn: '1 / -1' }}>
            <label>Objeto do Contrato</label>
            <div style={{
              backgroundColor: 'var(--bg-base)',
              border: '1px solid var(--border)',
              borderLeft: '3px solid var(--accent-border)',
              padding: '0.875rem 1rem',
              borderRadius: 'var(--radius-md)',
              color: 'var(--text-mid)',
              lineHeight: 1.7,
              fontSize: '0.875rem',
              marginTop: '0.375rem',
            }}>
              {contrato.objeto || 'Não descrito.'}
            </div>
          </div>
        </div>
      </div>

      {/* Verificador de Regularidade */}
      <div className="section-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.25rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h3 className="section-title" style={{ marginBottom: '0.25rem' }}>
              <ShieldCheck size={18} style={{ color: 'var(--accent-primary)' }} />
              Regularidade do Fornecedor
            </h3>
            {contrato.fornecedor_verificado_em && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Última verificação: {new Date(contrato.fornecedor_verificado_em).toLocaleString('pt-BR')}
                {' — '}
                <span style={{ fontWeight: 600, color: contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-text)' : 'var(--status-vencido-text)' }}>
                  {contrato.fornecedor_situacao === 'APTO' ? 'Fornecedor Apto' : 'Com Restrições'}
                </span>
              </p>
            )}
            {!cnpjEfetivo && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.625rem' }}>
                <input
                  className="form-input"
                  style={{ width: 200, fontSize: '0.875rem', padding: '0.375rem 0.75rem' }}
                  placeholder="CNPJ para verificar"
                  value={cnpjTemp}
                  onChange={e => setCnpjTemp(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>não salvo no contrato</span>
              </div>
            )}
          </div>
          <button
            className="btn-primary"
            onClick={handleVerificarRegularidade}
            disabled={verificando || (!cnpjEfetivo && !cnpjTemp.replace(/\D/g, ''))}
            style={{ flexShrink: 0 }}
          >
            {verificando
              ? <><Loader2 size={15} className="spin" /> Verificando...</>
              : <><ShieldCheck size={15} /> Verificar Agora</>}
          </button>
        </div>

        {regularidade && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {/* Receita Federal */}
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
                A) Receita Federal — Situação Cadastral
              </p>
              {regularidade.receitaFederal?.erro ? (
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertCircle size={14} /> {regularidade.receitaFederal.erro}
                </p>
              ) : (
                <div style={{ fontSize: '0.8125rem', display: 'flex', flexDirection: 'column', gap: '0.25rem', color: 'var(--text-secondary)' }}>
                  <p><span style={{ color: 'var(--text-tertiary)' }}>Razão Social:</span> <span style={{ color: 'var(--text-primary)' }}>{regularidade.receitaFederal?.razaoSocial}</span></p>
                  <p>
                    <span style={{ color: 'var(--text-tertiary)' }}>Situação: </span>
                    <span style={{ color: regularidade.receitaFederal?.situacao?.toLowerCase().includes('ativa') ? 'var(--status-ativo-text)' : 'var(--status-vencido-text)', fontWeight: 600 }}>
                      {regularidade.receitaFederal?.situacao || '—'}
                    </span>
                  </p>
                  <p><span style={{ color: 'var(--text-tertiary)' }}>Data Abertura:</span> {regularidade.receitaFederal?.dataAbertura || '—'}</p>
                </div>
              )}
            </div>

            {/* CEIS */}
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
                B) CEIS — Empresas Sancionadas (CGU)
              </p>
              {regularidade.ceis?.erro ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertCircle size={14} /> {regularidade.ceis.erro}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  {regularidade.ceis?.total === 0 ? (
                    <><ShieldCheck size={16} color="var(--status-ativo-text)" /> <span style={{ color: 'var(--status-ativo-text)', fontWeight: 600 }}>Nenhuma sanção encontrada</span></>
                  ) : (
                    <><ShieldX size={16} color="var(--status-vencido-text)" /> <span style={{ color: 'var(--status-vencido-text)', fontWeight: 600 }}>{regularidade.ceis?.total} sanção(ões) ativa(s)</span></>
                  )}
                </div>
              )}
            </div>

            {/* CNEP */}
            <div style={{ padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--bg-tertiary)' }}>
              <p style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '0.625rem', color: 'var(--text-primary)' }}>
                C) CNEP — Empresas Punidas (CGU)
              </p>
              {regularidade.cnep?.erro ? (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
                  <AlertCircle size={14} /> {regularidade.cnep.erro}
                </p>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem' }}>
                  {regularidade.cnep?.total === 0 ? (
                    <><ShieldCheck size={16} color="var(--status-ativo-text)" /> <span style={{ color: 'var(--status-ativo-text)', fontWeight: 600 }}>Nenhuma punição encontrada</span></>
                  ) : (
                    <><ShieldX size={16} color="var(--status-vencido-text)" /> <span style={{ color: 'var(--status-vencido-text)', fontWeight: 600 }}>{regularidade.cnep?.total} punição(ões) encontrada(s)</span></>
                  )}
                </div>
              )}
            </div>

            {/* Resultado final */}
            {contrato.fornecedor_situacao && (
              <div style={{
                padding: '1rem 1.25rem',
                borderRadius: 'var(--radius-lg)',
                backgroundColor: contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-bg)' : 'var(--status-vencido-bg)',
                border: `1px solid ${contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-border)' : 'var(--status-vencido-border)'}`,
                display: 'flex', alignItems: 'center', gap: '0.875rem',
              }}>
                {contrato.fornecedor_situacao === 'APTO'
                  ? <ShieldCheck size={22} color="var(--status-ativo-text)" />
                  : <ShieldX size={22} color="var(--status-vencido-text)" />}
                <div>
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-text)' : 'var(--status-vencido-text)', letterSpacing: '0.04em' }}>
                    {contrato.fornecedor_situacao === 'APTO' ? 'FORNECEDOR APTO' : 'FORNECEDOR COM RESTRIÇÕES'}
                  </p>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.125rem' }}>
                    {contrato.fornecedor_situacao === 'APTO'
                      ? 'Nenhuma irregularidade encontrada nas bases consultadas.'
                      : 'Verifique as pendências acima antes de prosseguir.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
