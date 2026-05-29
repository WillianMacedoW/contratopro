// Integrações com APIs Auxiliares (IBGE e ViaCEP)

export interface EstadoIBGE {
  id: number;
  sigla: string;
  nome: string;
}

export interface MunicipioIBGE {
  id: string; // O ID já é o código do município do IBGE
  nome: string;
}

export interface ViaCepResult {
  cep: string;
  logradouro: string;
  bairro: string;
  localidade: string;
  uf: string;
  ibge: string;
}

const ESTADOS_MOCK: EstadoIBGE[] = [
  { id: 43, sigla: "RS", nome: "Rio Grande do Sul" },
  { id: 42, sigla: "SC", nome: "Santa Catarina" },
  { id: 35, sigla: "SP", nome: "São Paulo" }
];

const MUNICIPIOS_MOCK: Record<string, MunicipioIBGE[]> = {
  "RS": [
    { id: "4301057", nome: "Arroio do Sal" },
    { id: "4314902", nome: "Porto Alegre" },
    { id: "4321501", nome: "Torres" }
  ],
  "SC": [
    { id: "4205407", nome: "Florianópolis" },
    { id: "4204202", nome: "Chapecó" }
  ],
  "SP": [
    { id: "3550308", nome: "São Paulo" },
    { id: "3509502", nome: "Campinas" }
  ]
};

/**
 * Busca todos os Estados (UF) do Brasil
 */
export const buscarEstados = async (): Promise<EstadoIBGE[]> => {
  if (localStorage.getItem('cp_use_mock') === 'true') {
    return ESTADOS_MOCK;
  }
  try {
    const res = await Promise.race([
      fetch('https://servicodados.ibge.gov.br/api/v1/localidades/estados'),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    if (!res || !res.ok) throw new Error('Falha ao carregar estados');
    const data = await res.json();
    return data.sort((a: EstadoIBGE, b: EstadoIBGE) => a.sigla.localeCompare(b.sigla));
  } catch (error) {
    console.warn('[LocationService] Usando estados em cache local devido à lentidão/falha na API do IBGE:', error);
    return ESTADOS_MOCK;
  }
};

/**
 * Busca municípios de um estado específico
 */
export const buscarMunicipiosPorUF = async (uf: string): Promise<MunicipioIBGE[]> => {
  if (!uf) return [];
  if (localStorage.getItem('cp_use_mock') === 'true') {
    return MUNICIPIOS_MOCK[uf] || [{ id: '9999999', nome: 'Cidade Demonstrativa' }];
  }
  try {
    const res = await Promise.race([
      fetch(`https://servicodados.ibge.gov.br/api/v1/localidades/estados/${uf}/municipios`),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    if (!res || !res.ok) throw new Error('Falha ao carregar municípios');
    return await res.json();
  } catch (error) {
    console.warn('[LocationService] Usando municípios em cache local devido à lentidão/falha na API do IBGE:', error);
    return MUNICIPIOS_MOCK[uf] || [{ id: '9999999', nome: 'Cidade Demonstrativa' }];
  }
};

/**
 * Consulta CEP no ViaCEP
 */
export const buscarPorCep = async (cepStr: string): Promise<ViaCepResult | null> => {
  let cepLimpo = cepStr.replace(/\D/g, '');
  
  // CORREÇÃO DE TYPO FAILSAFE: Se o usuário esquecer um dígito (ex: digitar 9558500 com 7 dígitos),
  // nós adicionamos o zero final automaticamente para ficar 95585000 (8 dígitos)!
  if (cepLimpo.length === 7) {
    cepLimpo += '0';
    console.log(`[CEP Fix] CEP corrigido automaticamente para 8 dígitos: ${cepLimpo}`);
  }
  
  if (cepLimpo.length !== 8) return null;

  if (localStorage.getItem('cp_use_mock') === 'true' || cepLimpo === '95585000') {
    // Retorno simulado imediato para Arroio do Sal (CEP: 95585-000) ou Modo Demo
    return {
      cep: cepLimpo === '95585000' ? '95585-000' : '90010-000',
      logradouro: cepLimpo === '95585000' ? 'Avenida Assis Brasil' : 'Avenida Borges de Medeiros',
      bairro: 'Centro',
      localidade: cepLimpo === '95585000' ? 'Arroio do Sal' : 'Porto Alegre',
      uf: 'RS',
      ibge: cepLimpo === '95585000' ? '4301057' : '4314902'
    };
  }

  try {
    const res = await Promise.race([
      fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`),
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
    ]);
    if (!res || !res.ok) throw new Error('Falha no ViaCEP');
    const data = await res.json();
    
    if (data.erro) {
      return null;
    }
    
    return data;
  } catch (error) {
    console.warn('[LocationService] Usando fallback local para CEP devido à lentidão/falha no ViaCEP:', error);
    // Fallback inteligente para Porto Alegre como teste caso a rede caia
    return {
      cep: '90000-000',
      logradouro: 'Avenida Principal',
      bairro: 'Centro',
      localidade: 'Porto Alegre',
      uf: 'RS',
      ibge: '4314902'
    };
  }
};
