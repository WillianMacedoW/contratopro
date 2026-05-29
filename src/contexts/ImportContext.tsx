import React, { createContext, useContext, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { calcularStatus } from '../utils/statusUtils';
import { buscarTodosContratosPNCP } from '../services/pncpService';

export interface ImportStatus {
  fase: 'ocioso' | 'buscando' | 'secretarias' | 'salvando' | 'concluido' | 'erro';
  mensagem: string;
  progresso: number;
  total: number;
}

interface ImportContextValue {
  importStatus: ImportStatus;
  iniciarImport: (params: {
    municipioId: string;
    municipioNome: string;
    filtroOrgao: string;
  }) => Promise<void>;
  limparStatus: () => void;
}

const OCIOSO: ImportStatus = { fase: 'ocioso', mensagem: '', progresso: 0, total: 0 };

const ImportContext = createContext<ImportContextValue | null>(null);

export const ImportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [importStatus, setImportStatus] = useState<ImportStatus>(OCIOSO);
  // Ref para que closures dentro do import sempre leiam o setter mais recente
  const setStatus = useRef(setImportStatus);
  setStatus.current = setImportStatus;

  const set = (s: ImportStatus) => setStatus.current(s);
  const upd = (fn: (p: ImportStatus) => ImportStatus) => setStatus.current(fn);

  const upsertSecretarias = async (
    nomes: string[],
    municipio: string
  ): Promise<Record<string, string>> => {
    const validos = nomes.filter(n => n && n !== 'Órgão não listado');
    if (validos.length === 0) return {};

    const { data: existentes } = await supabase
      .from('secretarias')
      .select('id, nome')
      .in('nome', validos);

    const mapa: Record<string, string> = {};
    const existMap = new Map<string, string>();
    for (const s of existentes || []) { existMap.set(s.nome, s.id); mapa[s.nome] = s.id; }

    const novas = validos.filter(n => !existMap.has(n));
    if (novas.length > 0) {
      await supabase
        .from('secretarias')
        .insert(novas.map(nome => ({ nome, municipio })));
      const { data: inseridas } = await supabase
        .from('secretarias')
        .select('id, nome')
        .in('nome', novas);
      for (const s of inseridas || []) mapa[s.nome] = s.id;
    }
    return mapa;
  };

  const iniciarImport = async ({ municipioId, municipioNome, filtroOrgao }: {
    municipioId: string;
    municipioNome: string;
    filtroOrgao: string;
  }) => {
    set({ fase: 'buscando', mensagem: `Descobrindo órgãos (IBGE ${municipioId})...`, progresso: 0, total: 0 });

    try {
      let contratos = await buscarTodosContratosPNCP(
        municipioId,
        (n) => upd(s => ({ ...s, progresso: n, mensagem: `Buscando no PNCP... ${n} encontrados` }))
      );

      if (filtroOrgao.trim()) {
        contratos = contratos.filter(c => c.orgao.toLowerCase().includes(filtroOrgao.toLowerCase()));
      }

      if (contratos.length === 0) {
        set({ fase: 'erro', mensagem: 'Nenhum contrato encontrado no PNCP para este município.', progresso: 0, total: 0 });
        return;
      }

      upd(s => ({ ...s, fase: 'secretarias', mensagem: `${contratos.length} contratos encontrados. Criando secretarias...` }));

      const orgaosUnicos = [...new Set(contratos.map(c => c.orgao))];
      const mapaSecretarias = await upsertSecretarias(orgaosUnicos, municipioNome);

      const hoje = new Date().toISOString().split('T')[0];
      const payload = contratos
        .filter(c => c.data_vencimento && c.data_vencimento.length === 10)
        .map(c => ({
          fornecedor: c.fornecedor || 'Fornecedor não informado',
          objeto: c.objeto || 'Objeto não descrito',
          numero_contrato: c.numero_contrato || 'S/N',
          numero_controle_pncp: c.id,
          valor_total: c.valor_total || 0,
          data_inicio: (c.data_inicio && c.data_inicio.length === 10) ? c.data_inicio : hoje,
          data_vencimento: c.data_vencimento,
          responsavel: c.fiscal || null,
          status: calcularStatus(c.data_vencimento),
          secretaria_id: mapaSecretarias[c.orgao] || null,
          fornecedor_cnpj: c.cnpj || null,
          tipo_objeto: 'servico',
        }));

      set({ fase: 'salvando', mensagem: `Salvando ${payload.length} contratos...`, progresso: 0, total: payload.length });

      let salvos = 0;
      let erros = 0;
      const LOTE = 100;
      for (let i = 0; i < payload.length; i += LOTE) {
        const lote = payload.slice(i, i + LOTE);
        const { error } = await supabase
          .from('contratos')
          .upsert(lote, { onConflict: 'numero_controle_pncp', ignoreDuplicates: false });
        if (error) {
          console.error('[Importar] Erro no lote:', error.message, error.details);
          erros += lote.length;
        } else {
          salvos += lote.length;
        }
        upd(s => ({ ...s, progresso: salvos + erros, mensagem: `Salvando... ${salvos} de ${payload.length}` }));
      }

      set({
        fase: 'concluido',
        mensagem: erros > 0
          ? `Concluído: ${salvos} salvos, ${erros} ignorados (sem data de vencimento).`
          : `✅ ${salvos} contratos importados com sucesso!`,
        progresso: salvos,
        total: payload.length,
      });
    } catch (err: any) {
      console.error('[Importar] Erro inesperado:', err);
      set({ fase: 'erro', mensagem: `Erro: ${err.message || 'Verifique o console.'}`, progresso: 0, total: 0 });
    }
  };

  const limparStatus = () => set(OCIOSO);

  return (
    <ImportContext.Provider value={{ importStatus, iniciarImport, limparStatus }}>
      {children}
    </ImportContext.Provider>
  );
};

export const useImport = () => {
  const ctx = useContext(ImportContext);
  if (!ctx) throw new Error('useImport fora do ImportProvider');
  return ctx;
};
