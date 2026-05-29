// Integração com a API Pública de Consulta do PNCP
// Documentação: https://pncp.gov.br/api/consulta/swagger-ui/index.html
//
// ARQUITETURA DA BUSCA:
// 1. /contratacoes/publicacao?codigoMunicipioIbge=X  → descobre os CNPJs dos órgãos do município
// 2. /contratos?cnpjOrgao=CNPJ                       → busca os contratos assinados (tem fornecedor, datas reais)
//
// A API rejeita janelas > 365 dias (HTTP 422). Usamos janelas de MAX_DIAS_JANELA.

const BASE_URL = '/api/pncp/v1';

const MODALIDADES_PADRAO = [6, 8, 4, 9, 12, 7, 5];
const TAMANHO_PAGINA = 50;
const MAX_PAGINAS = 20;       // Limite de segurança: 20 × 50 = 1.000 por CNPJ/janela
const MAX_DIAS_JANELA = 364;  // Limite da API

export interface PncpContratoResult {
  id: string;
  fornecedor: string;
  cnpj: string;
  objeto: string;
  numero_contrato: string;
  valor_total: number;
  data_inicio: string;
  data_vencimento: string;
  orgao: string;
  fiscal: string;
  tem_aditivos: boolean;
  status_vigencia: string;
  modalidade: string;
}

/** Helper de datas relativas para a semente simulada */
const getRelativeDate = (offsetDays: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split('T')[0];
};

const CONTRATOS_MOCK_PNCP: PncpContratoResult[] = [
  {
    id: '12345678000195-2026-001',
    fornecedor: 'SINALIZAÇÃO SUL BRASIL LTDA',
    cnpj: '12345678000195',
    objeto: 'Aquisição e instalação de placas de sinalização viária e demarcação de faixas de pedestres no perímetro municipal de Arroio do Sal.',
    numero_contrato: '045/2026',
    valor_total: 42300.00,
    data_inicio: getRelativeDate(-10),
    data_vencimento: getRelativeDate(350), // Em dia / OK
    orgao: 'Secretaria Municipal de Obras e Viação',
    fiscal: 'Carlos Alberto Souza',
    tem_aditivos: false,
    status_vigencia: 'Vigente',
    modalidade: 'Dispensa de Licitação | Serviços'
  },
  {
    id: '45678901000167-2026-002',
    fornecedor: 'ALIMENTA RS DISTRIBUIDORA DE ALIMENTOS EIRELI',
    cnpj: '45678901000167',
    objeto: 'Fornecimento de gêneros alimentícios perecíveis e não perecíveis para a merenda escolar das escolas municipais.',
    numero_contrato: '078/2026',
    valor_total: 125400.00,
    data_inicio: getRelativeDate(-25),
    data_vencimento: getRelativeDate(55), // Atenção (vence em 55 dias)
    orgao: 'Secretaria de Educação',
    fiscal: 'Mariana Costa Lima',
    tem_aditivos: true,
    status_vigencia: 'Vigente',
    modalidade: 'Pregão Eletrônico | Compras'
  },
  {
    id: '98765432000121-2026-003',
    fornecedor: 'MEDSUPPLY DISTRIBUIDORA DE MEDICAMENTOS SA',
    cnpj: '98765432000121',
    objeto: 'Prestação de serviços contínuos de análises clínicas laboratoriais para atendimento da rede básica e postos de saúde.',
    numero_contrato: '090/2026',
    valor_total: 89000.00,
    data_inicio: getRelativeDate(-45),
    data_vencimento: getRelativeDate(15), // Crítico (vence em 15 dias!)
    orgao: 'Secretaria de Saúde',
    fiscal: 'Dr. Roberto Silveira',
    tem_aditivos: false,
    status_vigencia: 'Vigente',
    modalidade: 'Inexigibilidade | Serviços'
  }
];

/** Formata Date para YYYYMMDD */
const fmt = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
};

/**
 * Gera janelas de tempo respeitando o limite de MAX_DIAS_JANELA da API.
 * Retorna array de { dataInicial, dataFinal } do mais recente ao mais antigo.
 */
const gerarJanelas = (totalDias: number): { dataInicial: string; dataFinal: string }[] => {
  const janelas: { dataInicial: string; dataFinal: string }[] = [];
  let fim = new Date();

  while (totalDias > 0) {
    const diasJanela = Math.min(totalDias, MAX_DIAS_JANELA);
    const inicio = new Date(fim);
    inicio.setDate(inicio.getDate() - diasJanela);
    janelas.push({ dataFinal: fmt(fim), dataInicial: fmt(inicio) });
    fim = new Date(inicio);
    fim.setDate(fim.getDate() - 1);
    totalDias -= diasJanela;
  }

  return janelas;
};

/**
 * Etapa 1: Descobre os CNPJs dos órgãos de um município via /contratacoes/publicacao.
 * Busca em múltiplas janelas (até 3 anos) para cobrir municípios com pouca atividade recente.
 */
const resolverCNPJsDoMunicipio = async (
  codigoMunicipioIbge: string,
  modalidades: number[] = MODALIDADES_PADRAO
): Promise<string[]> => {
  const janelas = gerarJanelas(MAX_DIAS_JANELA * 3); // até 3 anos
  const cnpjs = new Set<string>();

  for (const janela of janelas) {
    const promessas = modalidades.map(async (modalidade) => {
      try {
        const url = `${BASE_URL}/contratacoes/publicacao?dataInicial=${janela.dataInicial}&dataFinal=${janela.dataFinal}&codigoMunicipioIbge=${codigoMunicipioIbge}&codigoModalidadeContratacao=${modalidade}&pagina=1&tamanhoPagina=${TAMANHO_PAGINA}`;
        const res = await fetch(url, { headers: { Accept: '*/*' } });
        if (!res.ok) return;
        const data = await res.json();
        const items: any[] = data.data || [];
        for (const item of items) {
          const cnpj = item.orgaoEntidade?.cnpj;
          if (cnpj) cnpjs.add(cnpj);
        }
      } catch { /* ignora erros de modalidade individual */ }
    });

    await Promise.all(promessas);

    // Para assim que encontrar ao menos um CNPJ — evita buscas desnecessárias
    if (cnpjs.size > 0) break;
  }

  const lista = Array.from(cnpjs);
  console.log(`[PNCP] CNPJs descobertos para IBGE ${codigoMunicipioIbge}:`, lista);
  return lista;
};

/**
 * Etapa 2: Busca uma página de contratos assinados para um CNPJ.
 */
const buscarPaginaContratos = async (
  cnpjOrgao: string,
  dataInicial: string,
  dataFinal: string,
  pagina: number
): Promise<{ resultados: PncpContratoResult[]; totalPaginas: number }> => {
  const url = `${BASE_URL}/contratos?cnpjOrgao=${cnpjOrgao}&dataInicial=${dataInicial}&dataFinal=${dataFinal}&pagina=${pagina}&tamanhoPagina=${TAMANHO_PAGINA}`;
  const res = await fetch(url, { headers: { Accept: '*/*' } });

  if (!res.ok) {
    console.warn(`[PNCP] /contratos CNPJ ${cnpjOrgao} p.${pagina}: HTTP ${res.status}`);
    return { resultados: [], totalPaginas: 0 };
  }

  const data = await res.json();
  const itens: any[] = data.data || [];
  const totalPaginas: number = data.totalPaginas || 1;

  console.log(`[PNCP] CNPJ ${cnpjOrgao} p.${pagina}/${totalPaginas}: ${itens.length} contratos`);
  return { resultados: itens.map(mapearContrato), totalPaginas };
};

/**
 * Busca rápida (primeira página) — para prévia.
 */
export const buscarContratosPNCP = async (
  codigoMunicipioIbge: string
): Promise<PncpContratoResult[]> => {
  try {
    const cnpjs = await resolverCNPJsDoMunicipio(codigoMunicipioIbge);
    if (cnpjs.length === 0) return [];

    const [janela] = gerarJanelas(MAX_DIAS_JANELA);

    const promessas = cnpjs.map(async (cnpj) => {
      try {
        const { resultados } = await buscarPaginaContratos(cnpj, janela.dataInicial, janela.dataFinal, 1);
        return resultados;
      } catch {
        return [];
      }
    });

    const todos = (await Promise.all(promessas)).flat();
    const unicos = Array.from(new Map(todos.map(c => [c.id, c])).values());
    console.log(`[PNCP] Prévia: ${unicos.length} contratos`);
    return unicos;
  } catch (err) {
    console.warn('[PNCP API] Falha na rede ou proxy do Vite. Retornando dados demonstrativos locais:', err);
    return CONTRATOS_MOCK_PNCP;
  }
};

/**
 * Importação em massa — percorre todas as páginas em múltiplas janelas (~3 anos).
 */
export const buscarTodosContratosPNCP = async (
  codigoMunicipioIbge: string,
  onProgress?: (importados: number) => void,
  _modalidades?: number[] // mantido por compatibilidade
): Promise<PncpContratoResult[]> => {
  try {
    const cnpjs = await resolverCNPJsDoMunicipio(codigoMunicipioIbge);
    if (cnpjs.length === 0) return [];

    const janelas = gerarJanelas(MAX_DIAS_JANELA * 3); // ~3 anos
    const acumulado: PncpContratoResult[] = [];

    for (const janela of janelas) {
      for (const cnpj of cnpjs) {
        let pagina = 1;
        let totalPaginas = 1;

        do {
          try {
            const resultado = await buscarPaginaContratos(cnpj, janela.dataInicial, janela.dataFinal, pagina);
            acumulado.push(...resultado.resultados);
            totalPaginas = resultado.totalPaginas;
            if (onProgress) onProgress(acumulado.length);
            if (resultado.resultados.length < TAMANHO_PAGINA) break;
            if (pagina >= MAX_PAGINAS) break;
            pagina++;
            await new Promise(r => setTimeout(r, 150));
          } catch (err) {
            console.error(`[PNCP] Erro CNPJ ${cnpj} p.${pagina}:`, err);
            break;
          }
        } while (pagina <= totalPaginas);
      }
    }

    const unicos = Array.from(new Map(acumulado.map(c => [c.id, c])).values());
    console.log(`[PNCP] Importação concluída: ${unicos.length} contratos únicos`);
    if (onProgress) onProgress(unicos.length);
    return unicos;
  } catch (err) {
    console.warn('[PNCP API] Falha na rede ou proxy do Vite. Retornando dados demonstrativos locais para importação:', err);
    if (onProgress) onProgress(3);
    return CONTRATOS_MOCK_PNCP;
  }
};

/** Mapeia item do endpoint /contratos para formato interno */
function mapearContrato(item: any): PncpContratoResult {
  const fornecedor = item.nomeRazaoSocialFornecedor || 'Fornecedor não informado';
  const cnpj = item.niFornecedor || '';

  return {
    id: item.numeroControlePNCP || item.numeroControlePncpCompra || String(Math.random()),
    fornecedor,
    cnpj,
    objeto: item.objetoContrato || item.objetoCompra || 'Objeto não descrito',
    numero_contrato: item.numeroContratoEmpenho || item.numeroCompra || 'S/N',
    valor_total: item.valorGlobal || item.valorInicial || item.valorTotalEstimado || 0,
    data_inicio: formatarData(item.dataVigenciaInicio || item.dataAssinatura),
    data_vencimento: formatarData(item.dataVigenciaFim),
    // Prefere a unidade orgânica (secretaria) sobre o órgão raiz (prefeitura/câmara)
    // Assim "SECRETARIA MUNICIPAL DE SAÚDE" aparece em vez de "MUNICIPIO DE ARROIO DO SAL"
    // Câmara e Prefeitura são CNPJs distintos → limites de dispensa já ficam separados
    orgao: item.unidadeOrgao?.nomeUnidade || item.orgaoEntidade?.razaoSocial || 'Secretaria não informada',
    fiscal: item.informacaoComplementar?.trim() || 'Não informado na API pública',
    tem_aditivos: (item.numeroRetificacao || 0) > 0,
    status_vigencia: item.tipoContrato?.nome || 'Publicado',
    modalidade: `${item.tipoContrato?.nome || ''} | ${item.categoriaProcesso?.nome || ''}`.replace(/^\s*\|\s*/, '').trim() || 'Não informado',
  };
}

function formatarData(dataStr: string | undefined | null): string {
  if (!dataStr) return '';
  return dataStr.split('T')[0];
}
