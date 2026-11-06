import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Search, Save, ArrowLeft, Loader2, MapPin, Download, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { calcularStatus } from '../utils/statusUtils';
import { buscarContratosPNCP } from '../services/pncpService';
import type { PncpContratoResult } from '../services/pncpService';
import { buscarEstados, buscarMunicipiosPorUF } from '../services/locationService';
import type { EstadoIBGE, MunicipioIBGE } from '../services/locationService';
import { useImport } from '../contexts/ImportContext';

interface Secretaria {
  id: string;
  nome: string;
  municipio: string;
  whatsapp?: string;
  email?: string;
}

const titleCase = (str: string) =>
  str.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

export const ContratoForm: React.FC<{ isImportMode?: boolean }> = ({ isImportMode = false }) => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { importStatus, iniciarImport, limparStatus } = useImport();

  const [loading, setLoading] = useState(false);
  const [pncpLoading, setPncpLoading] = useState(false);
  const [pncpResults, setPncpResults] = useState<PncpContratoResult[]>([]);
  const [buscaRealizada, setBuscaRealizada] = useState(false);

  // Secretarias
  const [secretarias, setSecretarias] = useState<Secretaria[]>([]);

  // Localização
  const [estados, setEstados] = useState<EstadoIBGE[]>([]);
  const [municipios, setMunicipios] = useState<MunicipioIBGE[]>([]);
  const [selectedEstado, setSelectedEstado] = useState('');
  const [selectedMunicipioId, setSelectedMunicipioId] = useState('');
  const [selectedMunicipioNome, setSelectedMunicipioNome] = useState('');
  const [filtroOrgao, setFiltroOrgao] = useState('');

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const [formData, setFormData] = useState({
    fornecedor: '',
    objeto: '',
    numero_contrato: '',
    valor_total: 0,
    data_inicio: '',
    data_vencimento: '',
    responsavel: '',
    secretaria_id: null as string | null,
    fornecedor_cnpj: '',
    tipo_objeto: 'servico',
  });

  useEffect(() => {
    if (isImportMode) {
      buscarEstados().then(setEstados);
    } else if (id) {
      fetchContrato();
    }
    carregarSecretarias();
  }, [id, isImportMode]);

  const carregarSecretarias = async () => {
    const { data } = await supabase.from('secretarias').select('*').order('nome');
    setSecretarias(data || []);
  };

  const fetchContrato = async () => {
    setLoading(true);
    const { data } = await supabase.from('contratos').select('*').eq('id', id).single();
    if (data) setFormData({
      ...data,
      secretaria_id: data.secretaria_id || null,
      fornecedor_cnpj: data.fornecedor_cnpj || '',
      tipo_objeto: data.tipo_objeto || 'servico',
    });
    setLoading(false);
  };

  const handleEstadoChange = async (uf: string) => {
    setSelectedEstado(uf);
    setSelectedMunicipioId('');
    setSelectedMunicipioNome('');
    setMunicipios(uf ? await buscarMunicipiosPorUF(uf) : []);
  };

  const handleMunicipioChange = (ibgeId: string) => {
    setSelectedMunicipioId(ibgeId);
    const mun = municipios.find(m => String(m.id) === ibgeId);
    setSelectedMunicipioNome(mun?.nome || '');
  };

  const buscarNomePorCNPJ = async (cnpj: string) => {
    try {
      const res = await fetch(`https://publica.cnpj.ws/cnpj/${cnpj}`);
      if (res.ok) {
        const d = await res.json();
        if (d.razao_social) {
          setFormData(f => ({ ...f, fornecedor: d.razao_social }));
        }
      }
    } catch { /* silencioso */ }
  };

  const handleSearchPNCP = async () => {
    if (!selectedMunicipioId) {
      alert('Selecione um município antes de pesquisar.');
      return;
    }
    setPncpLoading(true);
    setBuscaRealizada(false);
    setPncpResults([]);
    try {
      let resultados = await buscarContratosPNCP(selectedMunicipioId);
      if (filtroOrgao.trim()) {
        resultados = resultados.filter(c => c.orgao.toLowerCase().includes(filtroOrgao.toLowerCase()));
      }
      setPncpResults(resultados);
      setBuscaRealizada(true);
    } catch (error: any) {
      console.error('[PNCP] Falha na busca:', error);
      alert(`Erro ao buscar do PNCP: ${error.message}`);
      setBuscaRealizada(true);
    } finally {
      setPncpLoading(false);
    }
  };

  const handleImportarTodos = () => {
    if (!selectedMunicipioId) {
      alert('Selecione um município antes de importar.');
      return;
    }
    iniciarImport({ municipioId: selectedMunicipioId, municipioNome: selectedMunicipioNome, filtroOrgao });
  };

  const handleCancelarImport = () => limparStatus();

  const handleLimparTodosContratos = async () => {
    const confirmado = window.confirm(
      '⚠️ ATENÇÃO: Isso vai apagar TODOS os contratos importados do PNCP (numero_controle_pncp preenchido).\n\nContratos criados manualmente NÃO serão apagados.\n\nDeseja continuar?'
    );
    if (!confirmado) return;

    const { error, count } = await supabase
      .from('contratos')
      .delete({ count: 'exact' })
      .not('numero_controle_pncp', 'is', null);

    if (error) {
      alert(`Erro ao apagar: ${error.message}`);
    } else {
      alert(`✅ ${count ?? 0} contratos do PNCP removidos com sucesso.`);
    }
  };

  const selecionarContratoPNCP = async (contrato: PncpContratoResult) => {
    // Garante que a secretaria existe — busca ou cria inline
    let secretariaId: string | null = null;
    const { data: existente } = await supabase.from('secretarias').select('id').eq('nome', contrato.orgao).maybeSingle();
    if (existente) {
      secretariaId = existente.id;
    } else if (contrato.orgao) {
      await supabase.from('secretarias').insert({ nome: contrato.orgao, municipio: selectedMunicipioNome });
      const { data: criada } = await supabase.from('secretarias').select('id').eq('nome', contrato.orgao).maybeSingle();
      secretariaId = criada?.id || null;
    }
    await carregarSecretarias();
    setFormData({
      fornecedor: contrato.fornecedor,
      objeto: contrato.objeto,
      numero_contrato: contrato.numero_contrato,
      valor_total: contrato.valor_total,
      data_inicio: contrato.data_inicio,
      data_vencimento: contrato.data_vencimento,
      responsavel: contrato.fiscal,
      secretaria_id: secretariaId,
      fornecedor_cnpj: contrato.cnpj || '',
      tipo_objeto: 'servico',
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const errors: Record<string, string> = {};
    if (!formData.fornecedor.trim())    errors.fornecedor     = 'Campo obrigatório';
    if (!formData.objeto.trim())        errors.objeto         = 'Campo obrigatório';
    if (!formData.numero_contrato.trim()) errors.numero_contrato = 'Campo obrigatório';
    if (!formData.data_inicio)          errors.data_inicio    = 'Campo obrigatório';
    if (!formData.data_vencimento)      errors.data_vencimento = 'Campo obrigatório';
    if (formData.valor_total <= 0)      errors.valor_total    = 'Informe um valor maior que zero';

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return;
    }
    setFormErrors({});
    setLoading(true);
    const payload = {
      ...formData,
      status: calcularStatus(formData.data_vencimento),
      secretaria_id: formData.secretaria_id || null,
      fornecedor_cnpj: formData.fornecedor_cnpj || null,
      tipo_objeto: formData.tipo_objeto || 'servico',
    };

    const { error } = id && !isImportMode
      ? await supabase.from('contratos').update(payload).eq('id', id)
      : await supabase.from('contratos').insert([payload]);

    setLoading(false);
    if (error) {
      console.error(error);
      setFormErrors({ _geral: `Erro ao salvar: ${error.message || 'verifique sua conexão'}` });
    } else {
      navigate('/contratos');
    }
  };

  const importando = importStatus.fase !== 'ocioso' && importStatus.fase !== 'concluido' && importStatus.fase !== 'erro';

  return (
    <div className="fade-in" style={{ maxWidth: isImportMode ? '1000px' : '800px', margin: '0 auto' }}>
      <div className="page-header">
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn-secondary" onClick={() => navigate(-1)} style={{ marginRight: '1rem', padding: '0.5rem' }}>
            <ArrowLeft size={18} />
          </button>
          <h1 className="page-title">
            {isImportMode ? 'Importar do PNCP' : id ? 'Editar contrato' : 'Novo contrato'}
          </h1>
        </div>
        {isImportMode && (
          <button
            className="btn-secondary"
            style={{ color: 'var(--red)', borderColor: 'var(--red-border)' }}
            onClick={handleLimparTodosContratos}
          >
            Apagar contratos PNCP
          </button>
        )}
      </div>

      {isImportMode && (
        <div className="section-card" style={{ marginBottom: '2rem' }}>
          <h2 style={{ fontSize: '1.25rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <MapPin size={22} color="var(--accent-primary)" /> Parâmetros de Busca
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div>
              <label className="form-label">Estado (UF)</label>
              <select className="form-input" value={selectedEstado} onChange={e => handleEstadoChange(e.target.value)}>
                <option value="">Selecione...</option>
                {estados.map(est => <option key={est.id} value={est.sigla}>{est.nome} ({est.sigla})</option>)}
              </select>
            </div>

            <div>
              <label className="form-label">Município</label>
              <select className="form-input" value={selectedMunicipioId} onChange={e => handleMunicipioChange(e.target.value)} disabled={!selectedEstado}>
                <option value="">Selecione...</option>
                {municipios.map(mun => <option key={mun.id} value={String(mun.id)}>{mun.nome}</option>)}
              </select>
            </div>
          </div>

          {/* Filtro de órgão + botões de ação */}
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '1.5rem', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: '200px' }}>
              <label className="form-label">Filtrar por Secretaria/Órgão (opcional)</label>
              {secretarias.length > 0 ? (
                <select
                  className="form-input"
                  value={filtroOrgao}
                  onChange={e => setFiltroOrgao(e.target.value)}
                >
                  <option value="">Todas as Secretarias</option>
                  {secretarias.map(s => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              ) : (
                <input
                  className="form-input"
                  value={filtroOrgao}
                  onChange={e => setFiltroOrgao(e.target.value)}
                  placeholder="Ex: Secretaria Municipal de Saúde"
                />
              )}
            </div>
            <button type="button" className="btn-secondary" onClick={handleSearchPNCP} disabled={pncpLoading || !selectedMunicipioId || importando}>
              {pncpLoading ? <Loader2 size={18} className="spin" /> : <Search size={18} />}
              Ver Prévia
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={handleImportarTodos}
              disabled={!selectedMunicipioId || importando}
            >
              <Download size={18} />
              Importar Todos para o Banco
            </button>
          </div>

          {/* Status da importação */}
          {importStatus.fase !== 'ocioso' && (
            <div style={{
              marginTop: '1.5rem',
              padding: '1rem 1.25rem',
              borderRadius: 'var(--radius-md)',
              border: `1px solid ${importStatus.fase === 'erro' ? 'var(--status-vencido-text)' : importStatus.fase === 'concluido' ? 'var(--status-ativo-text)' : 'var(--accent-primary)'}`,
              backgroundColor: 'var(--bg-secondary)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.5rem' }}>
                {importando && <Loader2 size={18} className="spin" style={{ color: 'var(--accent-primary)', flexShrink: 0 }} />}
                {importStatus.fase === 'erro' && <AlertCircle size={18} style={{ color: 'var(--status-vencido-text)', flexShrink: 0 }} />}
                <span style={{ fontWeight: 600, color: importStatus.fase === 'erro' ? 'var(--status-vencido-text)' : importStatus.fase === 'concluido' ? 'var(--status-ativo-text)' : 'var(--text-primary)' }}>
                  {importStatus.mensagem}
                </span>
              </div>

              {importStatus.total > 0 && importando && (
                <div style={{ height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    backgroundColor: 'var(--accent-primary)',
                    borderRadius: '999px',
                    width: `${Math.min(100, (importStatus.progresso / importStatus.total) * 100)}%`,
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}

              {(importStatus.fase === 'erro' || importStatus.fase === 'concluido') && (
                <button type="button" className="btn-secondary" style={{ marginTop: '0.75rem', fontSize: '0.8rem', padding: '0.25rem 0.75rem' }} onClick={handleCancelarImport}>
                  Fechar
                </button>
              )}
            </div>
          )}

          {/* Loading prévia */}
          {pncpLoading && (
            <div style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem', color: 'var(--text-secondary)' }}>
              <Loader2 size={32} className="spin" style={{ margin: '0 auto 1rem' }} />
              <p>Buscando prévia no Portal PNCP...</p>
            </div>
          )}

          {/* Sem resultados */}
          {buscaRealizada && pncpResults.length === 0 && !pncpLoading && (
            <div style={{ marginTop: '2rem', textAlign: 'center', padding: '2rem', border: '1px dashed var(--border-color)', borderRadius: 'var(--radius-md)', color: 'var(--text-secondary)' }}>
              <p style={{ fontSize: '1.1rem', marginBottom: '0.5rem' }}>Nenhuma contratação encontrada na prévia</p>
              <p style={{ fontSize: '0.875rem' }}>Tente um município diferente ou remova o filtro de órgão. A "Importar Todos" busca um período mais amplo.</p>
            </div>
          )}

          {/* Resultados da prévia */}
          {pncpResults.length > 0 && (
            <div style={{ marginTop: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>Prévia — {pncpResults.length} resultado(s)</h3>
              {pncpResults.map(res => (
                <div key={res.id} style={{ padding: '1.25rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--bg-primary)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
                    <strong style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{res.numero_contrato} — {titleCase(res.orgao)}</strong>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, padding: '0.1875rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>{res.modalidade}</span>
                      <span style={{ fontSize: '0.8125rem', color: 'var(--text-mid)' }}>{res.status_vigencia}</span>
                    </div>
                  </div>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem' }}><strong>Fornecedor:</strong> {titleCase(res.fornecedor)}</p>
                  <p style={{ fontSize: '0.875rem', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}><strong>Objeto:</strong> {res.objeto}</p>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '1rem' }}>
                    <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', display: 'flex', gap: '1rem' }}>
                      <span>Valor: R$ {res.valor_total.toLocaleString('pt-BR')}</span>
                      <span>{res.data_inicio} → {res.data_vencimento}</span>
                    </div>
                    <button type="button" className="btn-secondary" onClick={() => selecionarContratoPNCP(res)}>
                      Usar Dados
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {!isImportMode && <form className="section-card" onSubmit={handleSubmit}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem' }}>
          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Fornecedor</label>
            <input
              className="form-input"
              style={formErrors.fornecedor ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.fornecedor}
              onChange={e => { setFormData({ ...formData, fornecedor: e.target.value }); if (formErrors.fornecedor) setFormErrors(f => ({ ...f, fornecedor: '' })); }}
            />
            {formErrors.fornecedor && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.fornecedor}</span>}
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1' }}>
            <label className="form-label">Objeto</label>
            <textarea
              className="form-input"
              rows={3}
              style={formErrors.objeto ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.objeto}
              onChange={e => { setFormData({ ...formData, objeto: e.target.value }); if (formErrors.objeto) setFormErrors(f => ({ ...f, objeto: '' })); }}
            />
            {formErrors.objeto && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.objeto}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Número do contrato</label>
            <input
              className="form-input"
              style={formErrors.numero_contrato ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.numero_contrato}
              onChange={e => { setFormData({ ...formData, numero_contrato: e.target.value }); if (formErrors.numero_contrato) setFormErrors(f => ({ ...f, numero_contrato: '' })); }}
            />
            {formErrors.numero_contrato && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.numero_contrato}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Valor Total (R$)</label>
            <input
              type="number"
              step="0.01"
              className="form-input"
              style={formErrors.valor_total ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.valor_total}
              onChange={e => { setFormData({ ...formData, valor_total: parseFloat(e.target.value) || 0 }); if (formErrors.valor_total) setFormErrors(f => ({ ...f, valor_total: '' })); }}
            />
            {formErrors.valor_total && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.valor_total}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Início</label>
            <input
              type="date"
              className="form-input"
              style={formErrors.data_inicio ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.data_inicio}
              onChange={e => { setFormData({ ...formData, data_inicio: e.target.value }); if (formErrors.data_inicio) setFormErrors(f => ({ ...f, data_inicio: '' })); }}
            />
            {formErrors.data_inicio && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.data_inicio}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Vencimento</label>
            <input
              type="date"
              className="form-input"
              style={formErrors.data_vencimento ? { borderColor: 'var(--red, #e53e3e)' } : {}}
              value={formData.data_vencimento}
              onChange={e => { setFormData({ ...formData, data_vencimento: e.target.value }); if (formErrors.data_vencimento) setFormErrors(f => ({ ...f, data_vencimento: '' })); }}
            />
            {formErrors.data_vencimento && <span style={{ color: 'var(--red, #e53e3e)', fontSize: '0.75rem', marginTop: '0.25rem', display: 'block' }}>{formErrors.data_vencimento}</span>}
          </div>

          <div className="form-group">
            <label className="form-label">Fiscal responsável</label>
            <input className="form-input" value={formData.responsavel} onChange={e => setFormData({ ...formData, responsavel: e.target.value })} />
          </div>

          <div className="form-group">
            <label className="form-label">CNPJ do fornecedor</label>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                className="form-input"
                value={formData.fornecedor_cnpj}
                onChange={e => {
                  const v = e.target.value.replace(/\D/g, '');
                  const masked = v.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
                  setFormData({ ...formData, fornecedor_cnpj: masked });
                  if (v.length === 14) buscarNomePorCNPJ(v);
                }}
                placeholder="00.000.000/0000-00"
                maxLength={18}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Tipo de objeto</label>
            <select className="form-input" value={formData.tipo_objeto} onChange={e => setFormData({ ...formData, tipo_objeto: e.target.value })}>
              <option value="servico">Serviço</option>
              <option value="obra">Obra / Engenharia</option>
              <option value="compra">Compra</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Secretaria ou órgão</label>
            <select className="form-input" value={formData.secretaria_id || ''} onChange={e => setFormData({ ...formData, secretaria_id: e.target.value || null })}>
              <option value="">Sem secretaria</option>
              {secretarias.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
            </select>
          </div>
        </div>

        {formErrors._geral && (
          <div style={{ marginTop: '1.5rem', padding: '0.75rem 1rem', background: 'rgba(229,62,62,0.08)', border: '1px solid rgba(229,62,62,0.4)', borderRadius: 'var(--radius-md)', color: 'var(--red, #e53e3e)', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {formErrors._geral}
          </div>
        )}

        <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
          <button type="button" className="btn-secondary" onClick={() => navigate(-1)}>Cancelar</button>
          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <Save size={18} />}
            Salvar contrato
          </button>
        </div>
      </form>}
    </div>
  );
};
