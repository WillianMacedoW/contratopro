import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://qwqgcujehfarhemalszo.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF3cWdjdWplaGZhcmhlbWFsc3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM2MDIxMTksImV4cCI6MjA4OTE3ODExOX0.cGLQc8Wm6tLjDxJOTejUKshfjkn_GlnTBS_2u37D1MM';

// Cliente Supabase real
const realClient = createClient(supabaseUrl, supabaseKey);

// Controle de modo híbrido (lido diretamente via Proxy em localStorage)

// Função para verificar a conectividade do Supabase em segundo plano
export const verificarConexaoSupabase = async (): Promise<boolean> => {
  if (localStorage.getItem('cp_use_mock') === 'true') {
    return false; // Forçado para Modo Demo
  }
  try {
    const res = await Promise.race([
      fetch(`${supabaseUrl}/rest/v1/contratos?limit=1`, {
        method: 'GET',
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` }
      }),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2500))
    ]);
    if (res && res.ok) {
      return true;
    }
    return false;
  } catch {
    return false;
  }
};

// Inicialização automática do estado de conexão
verificarConexaoSupabase().then((estaOnline) => {
  if (!estaOnline && localStorage.getItem('cp_use_mock') !== 'false') {
    console.warn('[Supabase] Banco online indisponível. Ativando Modo Demonstração (Local) automaticamente.');
    localStorage.setItem('cp_use_mock', 'true');
  }
});

// Helper de datas relativas para manter a demonstração sempre real e bonita
const getRelativeDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

// Semente de dados iniciais do localStorage (baseado no supabase_setup.sql)
const inicializarSementeLocal = () => {
  if (!localStorage.getItem('cp_mock_secretarias')) {
    const secretarias = [
      { id: 's1', nome: 'Secretaria Municipal de Administração', municipio: 'Porto Alegre - RS', whatsapp: '51997519127', email: 'admin@portoalegre.rs.gov.br', created_at: new Date().toISOString() },
      { id: 's2', nome: 'Secretaria de Educação', municipio: 'Porto Alegre - RS', whatsapp: '51997519127', email: 'educacao@portoalegre.rs.gov.br', created_at: new Date().toISOString() },
      { id: 's3', nome: 'Secretaria de Saúde', municipio: 'Porto Alegre - RS', whatsapp: '51997519127', email: 'saude@portoalegre.rs.gov.br', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('cp_mock_secretarias', JSON.stringify(secretarias));
  }

  if (!localStorage.getItem('cp_mock_contratos')) {
    const contratos = [
      {
        id: 'c1',
        numero_contrato: '001/2024',
        numero_controle_pncp: '12345678000195-2024-001',
        fornecedor: 'Tech Solutions Ltda',
        fornecedor_cnpj: '12345678000195',
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: new Date().toISOString(),
        objeto: 'Fornecimento de licenças de software para gestão administrativa e infraestrutura interna.',
        tipo_objeto: 'servico',
        valor_total: 85000.00,
        data_inicio: getRelativeDate(-365),
        data_vencimento: getRelativeDate(-15), // Vencido a 15 dias
        responsavel: 'Willian Macedo',
        status: 'vencido',
        secretaria_id: 's1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'c2',
        numero_contrato: '002/2025',
        numero_controle_pncp: '98765432000121-2025-002',
        fornecedor: 'Construtora Horizonte SA',
        fornecedor_cnpj: '98765432000121',
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: new Date().toISOString(),
        objeto: 'Reforma e manutenção estrutural das instalações prediais da rede pública de ensino.',
        tipo_objeto: 'obra',
        valor_total: 320000.00,
        data_inicio: getRelativeDate(-90),
        data_vencimento: getRelativeDate(18), // Vence em 18 dias (Crítico)
        responsavel: 'Willian Macedo',
        status: 'vencendo',
        secretaria_id: 's2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'c3',
        numero_contrato: '003/2025',
        numero_controle_pncp: '45678901000167-2025-003',
        fornecedor: 'MedSupply Distribuidora',
        fornecedor_cnpj: '45678901000167',
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: new Date().toISOString(),
        objeto: 'Fornecimento continuado de materiais e insumos hospitalares e descartáveis de saúde.',
        tipo_objeto: 'compra',
        valor_total: 150000.00,
        data_inicio: getRelativeDate(-120),
        data_vencimento: getRelativeDate(245), // OK / Em dia
        responsavel: 'Willian Macedo',
        status: 'ativo',
        secretaria_id: 's3',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'c4',
        numero_contrato: '004/2025',
        numero_controle_pncp: '56789012000134-2025-004',
        fornecedor: 'DataCenter Cloud Ltda',
        fornecedor_cnpj: '56789012000134',
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: new Date().toISOString(),
        objeto: 'Serviços de hospedagem em nuvem privada, backup seguro e suporte técnico nível 3.',
        tipo_objeto: 'servico',
        valor_total: 48000.00,
        data_inicio: getRelativeDate(-45),
        data_vencimento: getRelativeDate(62), // Atenção (62 dias restantes)
        responsavel: 'Willian Macedo',
        status: 'ativo',
        secretaria_id: 's1',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      },
      {
        id: 'c5',
        numero_contrato: '005/2025',
        numero_controle_pncp: '67890123000112-2025-005',
        fornecedor: 'Gráfica Comunicação Visual',
        fornecedor_cnpj: '67890123000112',
        fornecedor_situacao: 'APTO',
        fornecedor_verificado_em: new Date().toISOString(),
        objeto: 'Impressão de materiais pedagógicos, apostilas escolares e kits didáticos anuais.',
        tipo_objeto: 'compra',
        valor_total: 28500.00,
        data_inicio: getRelativeDate(-10),
        data_vencimento: getRelativeDate(115), // Planejamento (115 dias restantes)
        responsavel: 'Willian Macedo',
        status: 'vencendo',
        secretaria_id: 's2',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
    ];
    localStorage.setItem('cp_mock_contratos', JSON.stringify(contratos));
  }

  if (!localStorage.getItem('cp_mock_profiles')) {
    const profiles = [
      { id: 'mock-user-admin-id', nome: 'Willian Macedo (Apresentador)', role: 'admin', created_at: new Date().toISOString() }
    ];
    localStorage.setItem('cp_mock_profiles', JSON.stringify(profiles));
  }
};

inicializarSementeLocal();

// Mock do Construtor de Consultas do Supabase (Implementa a interface fluente de queries)
class MockQueryBuilder {
  private table: string;
  private filters: { type: string; col: string; val?: any; vals?: any[]; filterType?: string }[] = [];
  private orderByField: string | null = null;
  private orderByAsc = true;
  private isSingleRow = false;
  private isMaybeSingleRow = false;
  private countMode: string | null = null;
  // Dados pré-inseridos para suportar encadeamento .insert().select()
  private pendingInsertData: any[] | null = null;
  private deleteCountMode: string | null = null;

  constructor(table: string) {
    this.table = table;
  }

  select(_fields?: string, options?: { count?: string; head?: boolean }) {
    if (options?.count) {
      this.countMode = options.count;
    }
    return this;
  }

  eq(col: string, val: any) {
    this.filters.push({ type: 'eq', col, val });
    return this;
  }

  neq(col: string, val: any) {
    this.filters.push({ type: 'neq', col, val });
    return this;
  }

  not(col: string, op: string, val: any) {
    // Suporta .not('campo', 'is', null) → filtra itens onde campo NÃO é null
    this.filters.push({ type: 'not', col, val, filterType: op });
    return this;
  }

  in(col: string, vals: any[]) {
    this.filters.push({ type: 'in', col, vals });
    return this;
  }

  order(col: string, options?: { ascending?: boolean }) {
    this.orderByField = col;
    this.orderByAsc = options?.ascending !== false;
    return this;
  }

  single() {
    this.isSingleRow = true;
    return this;
  }

  maybeSingle() {
    this.isMaybeSingleRow = true;
    return this;
  }

  // Permite encadeamento de Promises (then/catch) de forma transparente
  then(onfulfilled?: (value: any) => any, onrejected?: (reason: any) => any) {
    if (this._pendingDelete) {
      return this._executeDelete().then(onfulfilled, onrejected);
    }
    return this.execute().then(onfulfilled, onrejected);
  }

  private applyFilters(list: any[]): any[] {
    for (const filter of this.filters) {
      if (filter.type === 'eq') {
        list = list.filter((item: any) => item[filter.col] === filter.val);
      } else if (filter.type === 'neq') {
        list = list.filter((item: any) => item[filter.col] !== filter.val);
      } else if (filter.type === 'in') {
        list = list.filter((item: any) => filter.vals?.includes(item[filter.col]));
      } else if (filter.type === 'not') {
        if (filter.filterType === 'is') {
          // .not('col', 'is', null) → mantém apenas itens onde col NÃO é null
          list = list.filter((item: any) => item[filter.col] !== filter.val);
        }
      }
    }
    return list;
  }

  private async execute(): Promise<any> {
    try {
      // Se há dados pré-inseridos (encadeamento .insert().select()), retorna esses dados
      if (this.pendingInsertData !== null) {
        const inserted = this.pendingInsertData;
        if (this.isMaybeSingleRow) {
          return { data: inserted.length > 0 ? inserted[0] : null, error: null };
        }
        if (this.isSingleRow) {
          return { data: inserted.length > 0 ? inserted[0] : null, error: null };
        }
        return { data: inserted, error: null };
      }

      let list = JSON.parse(localStorage.getItem(`cp_mock_${this.table}`) || '[]');

      // Executa filtros
      list = this.applyFilters(list);

      // Resolve relacionamentos (Simula Join de Secretaria em Contratos)
      if (this.table === 'contratos') {
        const secretarias = JSON.parse(localStorage.getItem('cp_mock_secretarias') || '[]');
        list = list.map((contrato: any) => {
          const sec = secretarias.find((s: any) => s.id === contrato.secretaria_id);
          return {
            ...contrato,
            secretarias: sec || null
          };
        });
      }

      // Ordenação
      if (this.orderByField) {
        const field = this.orderByField;
        const asc = this.orderByAsc;
        list.sort((a: any, b: any) => {
          const valA = a[field];
          const valB = b[field];

          if (valA === undefined || valA === null) return 1;
          if (valB === undefined || valB === null) return -1;

          if (typeof valA === 'number' && typeof valB === 'number') {
            return asc ? valA - valB : valB - valA;
          }
          return asc
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
        });
      }

      if (this.countMode) {
        return { data: null, count: list.length, error: null };
      }

      if (this.isSingleRow) {
        if (list.length === 0) {
          return { data: null, error: { message: 'Nenhum registro encontrado.', details: '', hint: '', code: 'PGRST116' } };
        }
        return { data: list[0], error: null };
      }

      if (this.isMaybeSingleRow) {
        return { data: list.length > 0 ? list[0] : null, error: null };
      }

      return { data: list, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message || 'Erro no Banco Local' } };
    }
  }

  insert(payload: any): MockQueryBuilder {
    try {
      const list = JSON.parse(localStorage.getItem(`cp_mock_${this.table}`) || '[]');
      const items = Array.isArray(payload) ? payload : [payload];

      const inserted = items.map((item: any) => {
        const newItem = {
          id: item.id || crypto.randomUUID(),
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          ...item
        };
        list.push(newItem);
        return newItem;
      });

      localStorage.setItem(`cp_mock_${this.table}`, JSON.stringify(list));

      // Armazena os dados inseridos para suportar .insert().select()
      this.pendingInsertData = inserted;
      return this;
    } catch {
      this.pendingInsertData = [];
      return this;
    }
  }

  async update(payload: any) {
    try {
      let list = JSON.parse(localStorage.getItem(`cp_mock_${this.table}`) || '[]');

      // Executa os filtros acumulados para saber quais itens atualizar
      let matching = [...list];
      for (const filter of this.filters) {
        if (filter.type === 'eq') {
          matching = matching.filter((item: any) => item[filter.col] === filter.val);
        } else if (filter.type === 'neq') {
          matching = matching.filter((item: any) => item[filter.col] !== filter.val);
        } else if (filter.type === 'in') {
          matching = matching.filter((item: any) => filter.vals?.includes(item[filter.col]));
        }
      }

      const idsToUpdate = new Set(matching.map((item: any) => item.id));
      const updatedList = list.map((item: any) => {
        if (idsToUpdate.has(item.id)) {
          return {
            ...item,
            ...payload,
            updated_at: new Date().toISOString()
          };
        }
        return item;
      });

      localStorage.setItem(`cp_mock_${this.table}`, JSON.stringify(updatedList));

      const updatedRows = updatedList.filter((item: any) => idsToUpdate.has(item.id));
      return { data: updatedRows, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  delete(options?: { count?: string }) {
    if (options?.count) {
      this.deleteCountMode = options.count;
    }
    // Retorna this para permitir encadeamento: .delete({ count: 'exact' }).not(...)
    // A execução real ocorre via then()
    this._pendingDelete = true;
    return this;
  }

  private _pendingDelete = false;

  // Override do then para tratar deletes pendentes
  // (substituído dinamicamente abaixo via Proxy não é necessário — usamos a flag)
  private async _executeDelete(): Promise<any> {
    try {
      const list = JSON.parse(localStorage.getItem(`cp_mock_${this.table}`) || '[]');
      const matching = this.applyFilters([...list]);
      const idsToDelete = new Set(matching.map((item: any) => item.id));
      const keptList = list.filter((item: any) => !idsToDelete.has(item.id));
      localStorage.setItem(`cp_mock_${this.table}`, JSON.stringify(keptList));
      if (this.deleteCountMode === 'exact') {
        return { data: null, count: matching.length, error: null };
      }
      return { data: matching, error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }

  async upsert(payload: any, options?: { onConflict?: string }) {
    try {
      const list = JSON.parse(localStorage.getItem(`cp_mock_${this.table}`) || '[]');
      const items = Array.isArray(payload) ? payload : [payload];
      const conflictField = options?.onConflict || 'id';

      const results = items.map((item: any) => {
        const matchIdx = list.findIndex((existing: any) => existing[conflictField] === item[conflictField]);
        if (matchIdx >= 0) {
          list[matchIdx] = {
            ...list[matchIdx],
            ...item,
            updated_at: new Date().toISOString()
          };
          return list[matchIdx];
        } else {
          const newItem = {
            id: item.id || crypto.randomUUID(),
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            ...item
          };
          list.push(newItem);
          return newItem;
        }
      });

      localStorage.setItem(`cp_mock_${this.table}`, JSON.stringify(list));
      return { data: Array.isArray(payload) ? results : results[0], error: null };
    } catch (err: any) {
      return { data: null, error: { message: err.message } };
    }
  }
}

// Simulador de autenticação Supabase Auth
const mockAuth = {
  async getSession() {
    const sessionStr = localStorage.getItem('cp_mock_session');
    if (!sessionStr) return { data: { session: null }, error: null };

    const session = JSON.parse(sessionStr);
    return { data: { session }, error: null };
  },

  async signInWithPassword({ email, password: _password }: { email: string; password?: string }) {
    // Modo Demo aceita qualquer login ou valida contas criadas locais
    const profiles = JSON.parse(localStorage.getItem('cp_mock_profiles') || '[]');
    let profile = profiles.find((p: any) => p.email === email);

    if (!profile) {
      // Cria um perfil administrador sob demanda para facilitar a demonstração acadêmica
      profile = {
        id: crypto.randomUUID(),
        nome: email.split('@')[0].replace('.', ' ').toUpperCase(),
        role: 'admin',
        email: email,
        created_at: new Date().toISOString()
      };
      profiles.push(profile);
      localStorage.setItem('cp_mock_profiles', JSON.stringify(profiles));
    }

    const session = {
      user: {
        id: profile.id,
        email: email,
        raw_user_meta_data: { nome: profile.nome }
      },
      expires_at: Math.floor(Date.now() / 1000) + 3600
    };

    localStorage.setItem('cp_mock_session', JSON.stringify(session));

    // Despara evento de mudança de auth
    authListeners.forEach((listener) => listener('SIGNED_IN', session));

    return { data: { user: session.user }, error: null };
  },

  async signOut() {
    localStorage.removeItem('cp_mock_session');
    authListeners.forEach((listener) => listener('SIGNED_OUT', null));
    return { error: null };
  },

  onAuthStateChange(callback: (event: string, session: any) => void) {
    authListeners.add(callback);
    // Dispara estado inicial
    const sessionStr = localStorage.getItem('cp_mock_session');
    const session = sessionStr ? JSON.parse(sessionStr) : null;
    callback('INITIAL_SESSION', session);

    return {
      data: {
        subscription: {
          unsubscribe() {
            authListeners.delete(callback);
          }
        }
      }
    };
  }
};

const authListeners = new Set<(event: string, session: any) => void>();

// Cliente Mock
const mockClient = {
  auth: mockAuth,
  from(table: string) {
    return new MockQueryBuilder(table);
  }
};

// Exportação Dinâmica Híbrida do Supabase
export const supabase = new Proxy({} as any, {
  get(_, prop) {
    const client = (localStorage.getItem('cp_use_mock') === 'true') ? mockClient : realClient;
    return (client as any)[prop];
  }
});

