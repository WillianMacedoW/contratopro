import { differenceInDays, isBefore, startOfDay } from 'date-fns';

export type ContratoStatus = 'ativo' | 'vencendo' | 'vencido' | 'renovado';
export type NivelAlerta = 'critico' | 'atencao' | 'planejamento' | 'ok' | 'vencido' | 'renovado';

/**
 * Status base (mantido para compatibilidade com dados existentes).
 * - renovado → mantém sempre
 * - vencido  → já passou da data
 * - vencendo → até 30 dias (≡ CRÍTICO)
 * - ativo    → mais de 30 dias
 */
/**
 * Analisa uma string de data (YYYY-MM-DD) garantindo que seja criada no fuso horário LOCAL do navegador,
 * evitando o bug comum do JavaScript de deslocar a data em um dia a menos (UTC shift).
 */
export const parseDataLocal = (dataVal: string | Date): Date => {
  if (dataVal instanceof Date) return startOfDay(dataVal);
  const s = dataVal.split('T')[0];
  const parts = s.split('-');
  if (parts.length === 3) {
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1;
    const d = parseInt(parts[2], 10);
    return startOfDay(new Date(y, m, d));
  }
  return startOfDay(new Date(dataVal));
};

/**
 * Status base (mantido para compatibilidade com dados existentes).
 * - renovado → mantém sempre
 * - vencido  → já passou da data
 * - vencendo → até 30 dias (≡ CRÍTICO)
 * - ativo    → mais de 30 dias
 */
export const calcularStatus = (dataVencimento: string | Date, statusAtual?: ContratoStatus): ContratoStatus => {
  if (statusAtual === 'renovado') return 'renovado';

  if (!dataVencimento) return 'ativo';

  const hoje = startOfDay(new Date());
  const vencimento = parseDataLocal(dataVencimento);

  if (isBefore(vencimento, hoje)) return 'vencido';
  if (differenceInDays(vencimento, hoje) <= 30) return 'vencendo';
  return 'ativo';
};

/**
 * Nível de alerta detalhado (Lei 14.133/2021):
 * - CRÍTICO (≤ 30 dias)    → emitir termo aditivo
 * - ATENÇÃO (31–90 dias)   → publicar novo edital no PNCP
 * - PLANEJAMENTO (91–180 dias) → iniciar processo licitatório
 * - OK (> 180 dias)        → dentro do prazo
 * - VENCIDO                → data já passou
 * - RENOVADO               → renovado manualmente
 */
export const calcularNivelAlerta = (
  dataVencimento: string | Date | undefined | null,
  statusAtual?: ContratoStatus
): NivelAlerta => {
  if (statusAtual === 'renovado') return 'renovado';
  if (!dataVencimento) return 'ok';

  const hoje = startOfDay(new Date());
  const vencimento = parseDataLocal(dataVencimento);

  if (isBefore(vencimento, hoje)) return 'vencido';

  const dias = differenceInDays(vencimento, hoje);
  if (dias <= 30)  return 'critico';
  if (dias <= 90)  return 'atencao';
  if (dias <= 180) return 'planejamento';
  return 'ok';
};

export const NIVEL_ALERTA_CONFIG: Record<NivelAlerta, {
  label: string;
  cor: string;
  corBg: string;
  cssClass: string;
  descricao: string;
  acao: string;
}> = {
  critico: {
    label: 'Crítico',
    cor: '#ef4444',
    corBg: 'rgba(239,68,68,0.1)',
    cssClass: 'badge-alerta-critico',
    descricao: 'Vence em até 30 dias',
    acao: 'Emitir termo aditivo (art. 106 da Lei 14.133/2021)',
  },
  atencao: {
    label: 'Atenção',
    cor: '#f59e0b',
    corBg: 'rgba(245,158,11,0.1)',
    cssClass: 'badge-alerta-atencao',
    descricao: 'Vence entre 31 e 90 dias',
    acao: 'Publicar novo edital no PNCP e iniciar licitação',
  },
  planejamento: {
    label: 'Planejamento',
    cor: '#f59e0b',
    corBg: 'rgba(245,158,11,0.08)',
    cssClass: 'badge-alerta-planejamento',
    descricao: 'Vence entre 91 e 180 dias',
    acao: 'Iniciar planejamento do novo processo licitatório',
  },
  ok: {
    label: 'Em dia',
    cor: '#22c55e',
    corBg: 'rgba(34,197,94,0.1)',
    cssClass: 'badge-alerta-ok',
    descricao: 'Vence em mais de 180 dias',
    acao: 'Nenhuma ação imediata necessária',
  },
  vencido: {
    label: 'Vencido',
    cor: '#ef4444',
    corBg: 'rgba(239,68,68,0.1)',
    cssClass: 'badge-alerta-vencido',
    descricao: 'Contrato vencido',
    acao: 'Regularizar imediatamente — possível irregularidade contratual',
  },
  renovado: {
    label: 'Renovado',
    cor: '#a855f7',
    corBg: 'rgba(168,85,247,0.1)',
    cssClass: 'badge-alerta-renovado',
    descricao: 'Contrato renovado',
    acao: 'Verificar vigência do aditivo',
  },
};

export const formatarMoeda = (valor: number): string =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);

export const formatarCNPJ = (cnpj: string): string => {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
};
