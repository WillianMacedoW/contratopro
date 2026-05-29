import { supabase } from '../lib/supabase';
import { calcularNivelAlerta, calcularStatus } from '../utils/statusUtils';

export interface ContratoAlerta {
  id: string;
  numero_contrato: string;
  fornecedor: string;
  objeto: string;
  valor_total: number;
  data_vencimento: string;
  dias_restantes: number;
  nivel_alerta: string;
  secretaria: string;
  fiscal_nome: string;
  fiscal_whatsapp: string;
  secretario_nome: string;
  secretario_whatsapp: string;
}

export async function buscarContratosParaNotificar(): Promise<ContratoAlerta[]> {
  const { data, error } = await supabase
    .from('contratos')
    .select('id, numero_contrato, fornecedor, objeto, valor_total, data_vencimento, fiscal_nome, fiscal_whatsapp, secretario_nome, secretario_whatsapp, secretarias(nome)')
    .neq('status', 'renovado')
    .order('data_vencimento', { ascending: true });

  if (error || !data) return [];

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);

  return data
    .filter((c: any) => c.fiscal_whatsapp || c.secretario_whatsapp)
    .map((c: any) => {
      const status = calcularStatus(c.data_vencimento);
      const nivel = calcularNivelAlerta(c.data_vencimento, status);
      const venc = new Date(c.data_vencimento + 'T12:00:00');
      const dias = Math.ceil((venc.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
      return {
        id: c.id,
        numero_contrato: c.numero_contrato,
        fornecedor: c.fornecedor,
        objeto: c.objeto,
        valor_total: c.valor_total,
        data_vencimento: c.data_vencimento,
        dias_restantes: dias,
        nivel_alerta: nivel,
        secretaria: (Array.isArray(c.secretarias) ? c.secretarias[0]?.nome : (c.secretarias as { nome: string } | null)?.nome) || '',
        fiscal_nome: c.fiscal_nome || '',
        fiscal_whatsapp: c.fiscal_whatsapp || '',
        secretario_nome: c.secretario_nome || '',
        secretario_whatsapp: c.secretario_whatsapp || '',
      };
    })
    .filter((c: any) => ['critico', 'atencao', 'vencido'].includes(c.nivel_alerta));
}
