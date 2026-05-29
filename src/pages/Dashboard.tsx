import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, AlertTriangle, Clock, CheckCircle, Search, Filter, ShieldAlert, CalendarClock, Plus } from 'lucide-react';
import { Card } from '../components/Card';
import { Table } from '../components/Table';
import { BadgeAlerta } from '../components/Badge';
import { supabase } from '../lib/supabase';
import { calcularStatus, calcularNivelAlerta, formatarMoeda } from '../utils/statusUtils';
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

export const Dashboard: React.FC = () => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filteredData, setFilteredData] = useState<Contrato[]>([]);
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

    if (nivelFilter !== 'todos') {
      result = result.filter(c => c.nivelAlerta === nivelFilter);
    }

    setFilteredData(result);
  };

  const countNivel = (nivel: NivelAlerta) => filteredData.filter(c => c.nivelAlerta === nivel).length;

  const titleCase = (str: string) =>
    str.toLowerCase().replace(/\b(\p{L})/gu, l => l.toUpperCase());

  const truncate = (str: string, max = 38) =>
    str.length > max ? str.slice(0, max) + '…' : str;

  const columns = [
    {
      header: 'Contrato',
      cell: (c: Contrato) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>
          {c.numero_contrato}
        </span>
      ),
    },
    {
      header: 'Fornecedor',
      cell: (c: Contrato) => (
        <span style={{ fontWeight: 500 }}>{titleCase(c.fornecedor)}</span>
      ),
    },
    {
      header: 'Secretaria',
      cell: (c: Contrato) => c.secretarias?.nome
        ? <span style={{ color: 'var(--text-mid)', fontSize: '0.8125rem' }} title={c.secretarias.nome}>{truncate(titleCase(c.secretarias.nome))}</span>
        : <span style={{ color: 'var(--text-low)' }}>—</span>,
    },
    {
      header: 'Vencimento',
      cell: (c: Contrato) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
          {c.data_vencimento ? new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR') : '—'}
        </span>
      ),
    },
    {
      header: 'Valor',
      cell: (c: Contrato) => (
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
          {formatarMoeda(c.valor_total)}
        </span>
      ),
    },
    { header: 'Alerta', cell: (c: Contrato) => <BadgeAlerta nivel={c.nivelAlerta || 'ok'} /> },
  ];

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
          <h1 className="page-title">Visão Geral</h1>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
            {contratos.length} contratos cadastrados
          </p>
        </div>
        <button className="btn-primary" onClick={() => navigate('/contrato/novo')}>
          <Plus size={16} /> Novo Contrato
        </button>
      </div>

      {/* Cards de alertas */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '0.75rem', marginBottom: '2rem' }}>
        <Card title="Total" subtitle="contratos" value={filteredData.length} icon={<FileText size={16} />} />
        <Card title="Crítico" subtitle="vence em 30 dias" value={countNivel('critico')} icon={<AlertTriangle size={16} />} colorClass="card-danger" />
        <Card title="Atenção" subtitle="vence em 31–90 dias" value={countNivel('atencao')} icon={<ShieldAlert size={16} />} colorClass="card-warning" />
        <Card title="Planejamento" subtitle="vence em 91–180 dias" value={countNivel('planejamento')} icon={<CalendarClock size={16} />} colorClass="card-warning" />
        <Card title="Em dia" subtitle="mais de 180 dias" value={countNivel('ok')} icon={<CheckCircle size={16} />} colorClass="card-success" />
        <Card title="Vencidos" subtitle="prazo expirado" value={countNivel('vencido')} icon={<Clock size={16} />} colorClass="card-danger" />
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

        <div style={{ minWidth: '160px' }}>
          <select
            className="form-input"
            value={nivelFilter}
            onChange={e => setNivelFilter(e.target.value)}
          >
            <option value="todos">Todos os Níveis</option>
            <option value="critico">Crítico</option>
            <option value="atencao">Atenção</option>
            <option value="planejamento">Planejamento</option>
            <option value="ok">OK</option>
            <option value="vencido">Vencido</option>
            <option value="renovado">Renovado</option>
          </select>
        </div>
      </div>

      <p style={{ marginBottom: '0.75rem', fontSize: '0.8125rem', color: 'var(--text-tertiary)' }}>
        {filteredData.length === contratos.length
          ? `${contratos.length} contratos`
          : `${filteredData.length} de ${contratos.length} contratos`}
      </p>

      <Table
        data={filteredData}
        columns={columns}
        keyExtractor={c => c.id}
        onRowClick={c => navigate(`/contrato/${c.id}`)}
        emptyMessage="Nenhum contrato encontrado."
      />
    </div>
  );
};
