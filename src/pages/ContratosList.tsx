import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Database, Trash2, Eye } from 'lucide-react';
import { Badge } from '../components/Badge';
import { supabase } from '../lib/supabase';
import '../components/Table.css';
import { calcularStatus, formatarMoeda } from '../utils/statusUtils';
import type { ContratoStatus } from '../utils/statusUtils';

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
}

export const ContratosList: React.FC = () => {
  const navigate = useNavigate();
  const [contratos, setContratos] = useState<Contrato[]>([]);
  const [filteredData, setFilteredData] = useState<Contrato[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [secretariaFilter, setSecretariaFilter] = useState('todas');
  const [secretariasDisponiveis, setSecretariasDisponiveis] = useState<{ id: string; nome: string }[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deletando] = useState(false);
  const checkboxAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchContratos();
  }, []);

  useEffect(() => {
    let result = contratos;

    if (searchTerm.trim()) {
      const termo = searchTerm.toLowerCase();
      result = result.filter(c =>
        c.fornecedor.toLowerCase().includes(termo) ||
        c.numero_contrato.toLowerCase().includes(termo) ||
        c.objeto.toLowerCase().includes(termo) ||
        (c.secretarias?.nome || '').toLowerCase().includes(termo)
      );
    }

    if (secretariaFilter !== 'todas') {
      if (secretariaFilter === 'sem_secretaria') {
        result = result.filter(c => !c.secretaria_id);
      } else {
        result = result.filter(c => c.secretaria_id === secretariaFilter);
      }
    }

    if (statusFilter !== 'todos') {
      result = result.filter(c => c.status === statusFilter);
    }

    setFilteredData(result);
  }, [searchTerm, statusFilter, secretariaFilter, contratos]);

  // Atualiza estado indeterminate do checkbox "selecionar todos"
  useEffect(() => {
    if (!checkboxAllRef.current) return;
    const total = filteredData.length;
    const sel = selectedIds.size;
    checkboxAllRef.current.indeterminate = sel > 0 && sel < total;
    checkboxAllRef.current.checked = total > 0 && sel === total;
  }, [selectedIds, filteredData]);

  const fetchContratos = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('contratos')
        .select('*, secretarias(id, nome)')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const atualizados: Contrato[] = (data || []).map((cnt: any) => ({
        ...cnt,
        status: calcularStatus(cnt.data_vencimento, cnt.status),
      }));

      setContratos(atualizados);
      setSelectedIds(new Set());

      const secMap = new Map<string, { id: string; nome: string }>();
      atualizados.forEach(c => {
        if (c.secretarias) secMap.set(c.secretarias.id, c.secretarias);
      });
      setSecretariasDisponiveis(Array.from(secMap.values()).sort((a, b) => a.nome.localeCompare(b.nome)));
    } catch (error) {
      console.error('Erro ao buscar contratos:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    console.log('[checkbox] toggle id:', id);
    setSelectedIds(prev => {
      const nova = new Set(prev);
      nova.has(id) ? nova.delete(id) : nova.add(id);
      console.log('[checkbox] selecionados:', nova.size);
      return nova;
    });
  };

  const toggleSelecionarTodos = () => {
    if (selectedIds.size === filteredData.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredData.map(c => c.id)));
    }
  };

  const handleExcluirSelecionados = async () => {
    const ids = [...selectedIds];
    console.log('[D1] ids:', ids);
    if (ids.length === 0) return;
    try {
      const result = await supabase.from('contratos').delete({ count: 'exact' }).in('id', ids);
      console.log('[D2] resultado:', result);
      setSelectedIds(new Set());
      fetchContratos();
    } catch (e) {
      console.error('[D3] erro:', e);
    }
  };

  const titleCase = (str: string) =>
    str.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

  const truncate = (str: string, max = 38) =>
    str.length > max ? str.slice(0, max) + '…' : str;

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1 className="page-title">Todos os Contratos</h1>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="btn-secondary" onClick={() => navigate('/importar')}>
            <Database size={18} />
            Importar do PNCP
          </button>
          <button className="btn-primary" onClick={() => navigate('/contrato/novo')}>
            + Novo Contrato
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap' }}>
        <div style={{ flex: 2, minWidth: '220px', position: 'relative' }}>
          <Search size={16} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <input
            className="form-input"
            style={{ paddingLeft: '2.25rem' }}
            placeholder="Buscar por fornecedor, objeto ou número..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
          <Filter size={16} style={{ position: 'absolute', top: '50%', left: '0.75rem', transform: 'translateY(-50%)', color: 'var(--text-tertiary)' }} />
          <select
            className="form-input"
            style={{ paddingLeft: '2.25rem', appearance: 'none' }}
            value={secretariaFilter}
            onChange={(e) => setSecretariaFilter(e.target.value)}
          >
            <option value="todas">Todas as Secretarias</option>
            <option value="sem_secretaria">Sem Secretaria</option>
            {secretariasDisponiveis.map(s => (
              <option key={s.id} value={s.id}>{s.nome}</option>
            ))}
          </select>
        </div>

        <div style={{ minWidth: '160px' }}>
          <select
            className="form-input"
            style={{ appearance: 'none' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="todos">Todos os Status</option>
            <option value="ativo">Ativo</option>
            <option value="vencendo">Vencendo</option>
            <option value="vencido">Vencido</option>
            <option value="renovado">Renovado</option>
          </select>
        </div>
      </div>

      {isLoading ? (
        <p>Carregando contratos...</p>
      ) : (
        <>
          {/* Barra de seleção */}
          <div style={{ marginBottom: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
                <input
                  ref={checkboxAllRef}
                  type="checkbox"
                  onChange={toggleSelecionarTodos}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                />
                Selecionar todos
              </label>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {filteredData.length === contratos.length
                  ? `${contratos.length} contratos`
                  : `${filteredData.length} de ${contratos.length} contratos`}
              </span>
            </div>

            {selectedIds.size > 0 && (
              <button
                className="btn-secondary"
                style={{ color: 'var(--red)', borderColor: 'var(--red-border)' }}
                onClick={handleExcluirSelecionados}
                disabled={deletando}
              >
                <Trash2 size={16} />
                {deletando ? 'Excluindo...' : `Excluir ${selectedIds.size} selecionado(s)`}
              </button>
            )}
          </div>

          {/* Tabela manual — sem onRowClick para evitar conflito com checkboxes */}
          <div className="table-container">
            <table className="app-table">
              <thead>
                <tr>
                  <th style={{ width: '40px' }}></th>
                  <th>Nº Contrato</th>
                  <th>Fornecedor</th>
                  <th>Secretaria</th>
                  <th>Valor</th>
                  <th>Vencimento</th>
                  <th>Status</th>
                  <th style={{ width: '48px' }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="table-empty">Nenhum contrato encontrado.</td>
                  </tr>
                ) : (
                  filteredData.map(c => (
                    <tr key={c.id}>
                      <td>
                        <input
                          type="checkbox"
                          checked={selectedIds.has(c.id)}
                          onChange={() => toggleSelect(c.id)}
                          style={{ cursor: 'pointer', width: '16px', height: '16px' }}
                        />
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', color: 'var(--text-mid)' }}>
                          {c.numero_contrato}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{titleCase(c.fornecedor)}</td>
                      <td>
                        {c.secretarias?.nome
                          ? <span style={{ color: 'var(--text-mid)', fontSize: '0.8125rem' }} title={c.secretarias.nome}>{truncate(titleCase(c.secretarias.nome))}</span>
                          : <span style={{ color: 'var(--text-low)' }}>—</span>}
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                          {formatarMoeda(c.valor_total)}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8125rem', whiteSpace: 'nowrap' }}>
                          {new Date(c.data_vencimento + 'T12:00:00').toLocaleDateString('pt-BR')}
                        </span>
                      </td>
                      <td><Badge status={c.status} /></td>
                      <td>
                        <button
                          className="btn-secondary"
                          style={{ padding: '0.25rem 0.5rem' }}
                          onClick={() => navigate(`/contrato/${c.id}`)}
                          title="Ver contrato"
                        >
                          <Eye size={15} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};
