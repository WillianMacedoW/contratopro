import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit, CheckCircle, Trash2, ShieldCheck, ShieldX, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcularStatus, calcularNivelAlerta, formatarMoeda, formatarCNPJ, nomeSecretaria, titleCase } from '../utils/statusUtils';
import type { ContratoStatus } from '../utils/statusUtils';
import { Vigencia } from '../components/Vigencia';

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

    // Os CNPJs da demonstração são de exemplo e podem existir de verdade: nada sai para a internet aqui.
    if (localStorage.getItem('cp_use_mock') === 'true') {
      resultado.receitaFederal = {
        razaoSocial: titleCase(contrato!.fornecedor),
        situacao: 'Ativa, exemplo do modo demonstração',
        dataAbertura: '—',
      };
      resultado.ceis = { total: 0, sancoesAtivas: [] };
      resultado.cnep = { total: 0, punicoesAtivas: [] };
      const verificadoEm = new Date().toISOString();
      await supabase.from('contratos').update({
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: verificadoEm,
      }).eq('id', contrato!.id);
      setContrato(c => c ? { ...c, fornecedor_situacao: 'APTO', fornecedor_verificado_em: verificadoEm } : c);
      setRegularidade(resultado);
      setVerificando(false);
      return;
    }

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
      if (semChave) throw new Error('Consulta indisponível: falta configurar a chave do Portal da Transparência.');
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
      if (semChave) throw new Error('Consulta indisponível: falta configurar a chave do Portal da Transparência.');
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
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ padding: '0.5rem 0.625rem' }} aria-label="Voltar">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="page-title" style={{ fontSize: '1.5rem' }}>{fornecedorNome}</h1>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', marginTop: '0.125rem' }}>
              Contrato {contrato.numero_contrato}
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="btn-secondary" onClick={() => navigate(`/contrato/${contrato.id}/editar`)}>
            <Edit size={16} /> Editar
          </button>
          <button
            className="btn-primary"
            style={{ background: contrato.status === 'renovado' ? 'var(--status-renovado-bg)' : undefined, color: contrato.status === 'renovado' ? 'var(--status-renovado-text)' : undefined }}
            onClick={handleMarcarRenovado}
            disabled={contrato.status === 'renovado'}
          >
            <CheckCircle size={16} /> {contrato.status === 'renovado' ? 'Renovado' : 'Marcar como renovado'}
          </button>
          <button
            className="btn-secondary"
            style={{ color: 'var(--status-vencido-text)', borderColor: 'var(--status-vencido-border)' }}
            onClick={handleDelete}
            title="Excluir contrato"
            aria-label="Excluir contrato"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      {contrato.data_vencimento && (
        <Vigencia dataInicio={contrato.data_inicio} dataVencimento={contrato.data_vencimento} nivel={nivel} />
      )}

      <dl className="dados-contrato">
        <div>
          <dt>Valor total</dt>
          <dd className="dados-valor">{formatarMoeda(contrato.valor_total)}</dd>
        </div>
        <div>
          <dt>Fiscal responsável</dt>
          <dd>{contrato.responsavel || 'Não informado'}</dd>
        </div>
        {contrato.secretarias && (
          <div>
            <dt>Secretaria</dt>
            <dd>{nomeSecretaria(contrato.secretarias.nome)}</dd>
          </div>
        )}
        {cnpjFormatado && (
          <div>
            <dt>CNPJ</dt>
            <dd>{cnpjFormatado}</dd>
          </div>
        )}
      </dl>

      <section className="secao" aria-labelledby="titulo-objeto">
        <h2 id="titulo-objeto" className="secao-titulo" style={{ marginBottom: '0.375rem' }}>Objeto do contrato</h2>
        <p className="objeto-contrato">{contrato.objeto || 'Não descrito.'}</p>
      </section>

      {/* Verificador de Regularidade */}
      <section className="secao" aria-labelledby="titulo-regularidade">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1rem', gap: '1rem', flexWrap: 'wrap' }}>
          <div>
            <h2 id="titulo-regularidade" className="secao-titulo">Regularidade do fornecedor</h2>
            {contrato.fornecedor_verificado_em && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-mid)', marginTop: '0.125rem' }}>
                Última verificação: {new Date(contrato.fornecedor_verificado_em).toLocaleString('pt-BR')}
                {'. '}
                <span style={{ fontWeight: 600, color: contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-text)' : 'var(--status-vencido-text)' }}>
                  {contrato.fornecedor_situacao === 'APTO' ? 'Fornecedor apto' : 'Com restrições'}
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
              : <><ShieldCheck size={15} /> Verificar agora</>}
          </button>
        </div>

        {regularidade && (
          <div>
            {/* Receita Federal */}
            <div className="consulta">
              <p className="consulta-nome">
                Receita Federal, situação cadastral
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
            <div className="consulta">
              <p className="consulta-nome">
                CEIS, empresas sancionadas (CGU)
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
                    <><ShieldX size={16} color="var(--status-vencido-text)" /> <span style={{ color: 'var(--status-vencido-text)', fontWeight: 600 }}>{regularidade.ceis?.total} {regularidade.ceis?.total === 1 ? 'sanção ativa' : 'sanções ativas'}</span></>
                  )}
                </div>
              )}
            </div>

            {/* CNEP */}
            <div className="consulta">
              <p className="consulta-nome">
                CNEP, empresas punidas (CGU)
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
                    <><ShieldX size={16} color="var(--status-vencido-text)" /> <span style={{ color: 'var(--status-vencido-text)', fontWeight: 600 }}>{regularidade.cnep?.total} {regularidade.cnep?.total === 1 ? 'punição encontrada' : 'punições encontradas'}</span></>
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
                  <p style={{ fontWeight: 700, fontSize: '0.875rem', color: contrato.fornecedor_situacao === 'APTO' ? 'var(--status-ativo-text)' : 'var(--status-vencido-text)' }}>
                    {contrato.fornecedor_situacao === 'APTO' ? 'Fornecedor apto' : 'Fornecedor com restrições'}
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
      </section>
    </div>
  );
};
