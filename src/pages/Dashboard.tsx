import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Plus } from 'lucide-react';
import { ReguaVencimentos } from '../components/ReguaVencimentos';
import { supabase } from '../lib/supabase';
import { calcularStatus, calcularNivelAlerta, NIVEL_ALERTA_CONFIG } from '../utils/statusUtils';
import type { ContratoStatus, NivelAlerta } from '../utils/statusUtils';

interface Contrato {
  id: string;
  fornecedor: string;
  objeto: string;
  numero_contrato: string;
  valor_total: number;
  data_inicio: string;
  data_vencimento: string;
  responsavel: string;
  status: ContratoStatus;
  secretaria_id: string | null;
  secretarias?: { id: string; nome: string } | null;
  nivelAlerta?: NivelAlerta;
}

const NIVEIS_NA_LEGENDA: NivelAlerta[] = ['vencido', 'critico', 'atencao', 'planejamento', 'ok', 'renovado'];

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filteredData, setFilteredData] = useState<Contrato[]>([]);
  const [baseFiltrada, setBaseFiltrada] = useState<Contrato[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [secretariaFilter, setSecretariaFilter] = useState('todas');
  const [nivelFilter, setNivelFilter] = useState('todos');
  const [secretariasDisponiveis, setSecretariasDisponiveis] = useState<{ id: string; nome: string }[]>([]);

  useEffect(() => { fetchDashboardData(); }, []);
  useEffect(() => { aplicarFiltros(); }, [searchTerm, secretariaFilter, nivelFilter, contratos]);

  const fetchDashboardData = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contratos')
        .select('*, secretarias(id, nome)')
        .order('data_vencimento', { ascending: true });

      if (error) throw error;

      const atualizados: Contrato[] = (data || []).map((cnt: any) => {
        const status = calcularStatus(cnt.data_vencimento, cnt.status);
        return { ...cnt, status, nivelAlerta: calcularNivelAlerta(cnt.data_vencimento, status) };
      });

      setContratos(atualizados);

      const secMap = new Map<string, { id: string; nome: string }>();
      atualizados.forEach(c => { if (c.secretarias) secMap.set(c.secretarias.id, c.secretarias); });
      setSecretariasDisponiveis(Array.from(secMap.values()).sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (err) {
      console.error('Erro ao buscar dados:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const aplicarFiltros = () => {
    let result = contratos;

    if (searchTerm.trim()) {
      const t = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.fornecedor.toLowerCase().includes(t) ||
        c.numero_contrato.toLowerCase().includes(t) ||
        c.objeto.toLowerCase().includes(t) ||
        (c.secretarias?.nome || '').toLowerCase().includes(t)
      );
    }

    if (secretariaFilter !== 'todas') {
      result = secretariaFilter === 'sem_secretaria'
        ? result.filter(c => !c.secretaria_id)
        : result.filter(c => c.secretaria_id === secretariaFilter);
    }

    setBaseFiltrada(result);
    setFilteredData(nivelFilter === 'todos' ? result : result.filter(c => c.nivelAlerta === nivelFilter));
  };

  const limparFiltros = () => {
    setSearchTerm('');
    setSecretariaFilter('todas');
    setNivelFilter('todos');
  };

  // A legenda conta o que passou pela busca e pela secretaria, antes do filtro de nível.
  const countNivel = (nivel: NivelAlerta) => baseFiltrada.filter(c => c.nivelAlerta === nivel).length;

  const pedemAcao = contratos.filter(c => c.nivelAlerta === 'vencido' || c.nivelAlerta === 'critico').length;
  const resumo = pedemAcao === 0
    ? `Nenhum dos ${contratos.length} contratos pede ação agora`
    : `${pedemAcao} de ${contratos.length} contratos ${pedemAcao === 1 ? 'pede' : 'pedem'} ação agora`;

  if (isLoading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ width: '36px', height: '36px', border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Carregando...</span>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Visão geral</h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', marginTop: '0.25rem' }}>{resumo}</p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/contrato/novo')}>
          <Plus size={16} /> Novo contrato
        </button>
      </div>

      {/* Filtros */}
      <div className="filters-bar">
        <div className="filter-group" style={{ flex: 2, minWidth: '220px' }}>
          <Search size={15} className="filter-icon" />
          <input
            className="form-input"
            placeholder="Buscar fornecedor, objeto, número..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="filter-group" style={{ flex: 1, minWidth: '180px' }}>
          <Filter size={15} className="filter-icon" />
          <select
            className="form-input"
            value={secretariaFilter}
            onChange={e => setSecretariaFilter(e.target.value)}
          >
            <option value="todas">Todas as Secretarias</option>
            <option value="sem_secretaria">Sem Secretaria</option>
            {secretariasDisponiveis.map(s => <option key={s.id} value={s.id}>{s.nome}</option>)}
          </select>
        </div>

      </div>

      {/* Legenda: também filtra por nível */}
      <div className="legenda-niveis" role="group" aria-label="Filtrar por nível de alerta">
        <button
          className="legenda-nivel"
          aria-pressed={nivelFilter === 'todos'}
          onClick={() => setNivelFilter('todos')}
        >
          Todos <span>{baseFiltrada.length}</span>
        </button>
        {NIVEIS_NA_LEGENDA.filter(n => n !== 'renovado' || countNivel(n) > 0).map(n => (
          <button
            key={n}
            className="legenda-nivel"
            aria-pressed={nivelFilter === n}
            onClick={() => setNivelFilter(nivelFilter === n ? 'todos' : n)}
          >
            <i className={`legenda-amostra barra-${n}`} />
            {NIVEL_ALERTA_CONFIG[n].label} <span>{countNivel(n)}</span>
          </button>
        ))}
      </div>

      {filteredData.length > 0 ? (
        <ReguaVencimentos contratos={filteredData} />
      ) : contratos.length > 0 ? (
        <div className="estado-vazio">
          <p>Nenhum contrato com esses filtros.</p>
          <button className="btn-secondary" onClick={limparFiltros}>Limpar filtros</button>
        </div>
      ) : (
        <div className="estado-vazio">
          <p>Nenhum contrato cadastrado ainda.</p>
          <button className="btn-primary" onClick={() => navigate('/contrato/novo')}>
            <Plus size={16} /> Novo contrato
          </button>
        </div>
      )}
    </div>
  );
};
