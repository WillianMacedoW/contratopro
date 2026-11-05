import React from 'react';
import { Link } from 'react-router-dom';
import { addDays, addMonths, differenceInDays, format, getDaysInMonth, startOfDay, startOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { NIVEL_ALERTA_CONFIG, formatarMoeda, parseDataLocal } from '../utils/statusUtils';
import type { NivelAlerta } from '../utils/statusUtils';
import './ReguaVencimentos.css';

export interface ContratoRegua {
  id: string;
  fornecedor: string;
  numero_contrato: string;
  valor_total: number;
  data_vencimento: string;
  secretarias?: { id: string; nome: string } | null;
  nivelAlerta?: NivelAlerta;
}

const MESES_NA_REGUA = 12;
const MARCOS_LEGAIS = [30, 90, 180];

/** Acima disso a etiqueta entra na barra, para não sair da régua. */
const LIMITE_ETIQUETA_FORA = 74;

const ORDEM_URGENCIA: NivelAlerta[] = ['vencido', 'critico', 'atencao', 'planejamento', 'ok', 'renovado'];

const titleCase = (str: string) =>
  str.toLowerCase().replace(/(^|[^\p{L}\p{N}])(\p{L})/gu, (_, sep, l) => sep + l.toUpperCase());

const nomeSecretaria = (nome?: string) =>
  nome
    ? titleCase(nome).replace(/^Secretaria(\s+Municipal)?(\s+(De|Da|Do))?\s+/, '')
    : 'Sem secretaria';

const contagem = (n: number) => `${n} ${n === 1 ? 'contrato' : 'contratos'}`;

const prazoEmTexto = (dias: number, nivel: NivelAlerta) => {
  if (nivel === 'renovado') return 'Renovado';
  if (dias < 0) return `Venceu há ${Math.abs(dias)} ${dias === -1 ? 'dia' : 'dias'}`;
  if (dias === 0) return 'Vence hoje';
  return `${dias} ${dias === 1 ? 'dia' : 'dias'}`;
};

export const ReguaVencimentos: React.FC<{ contratos: ContratoRegua[] }> = ({ contratos }) => {
  const hoje = startOfDay(new Date());
  const inicio = startOfMonth(subMonths(hoje, 1));
  const meses = Array.from({ length: MESES_NA_REGUA }, (_, i) => addMonths(inicio, i));

  // Meses têm a mesma largura na régua; o dia é posicionado dentro do próprio mês.
  const posicao = (data: Date) => {
    const indice = (data.getFullYear() - inicio.getFullYear()) * 12 + data.getMonth() - inicio.getMonth();
    const fracao = (data.getDate() - 1) / getDaysInMonth(data);
    return Math.min(100, Math.max(0, ((indice + fracao) / MESES_NA_REGUA) * 100));
  };

  const posHoje = posicao(hoje);
  const marcos = MARCOS_LEGAIS.map(dias => ({ dias, pos: posicao(addDays(hoje, dias)) }));

  const mapa = new Map<string, ContratoRegua[]>();
  contratos.forEach(c => {
    const nome = nomeSecretaria(c.secretarias?.nome);
    mapa.set(nome, [...(mapa.get(nome) || []), c]);
  });
  const urgencia = (lista: ContratoRegua[]) =>
    Math.min(...lista.map(c => ORDEM_URGENCIA.indexOf(c.nivelAlerta || 'ok')));
  const grupos = Array.from(mapa.entries()).sort(
    ([nomeA, a], [nomeB, b]) => urgencia(a) - urgencia(b) || nomeA.localeCompare(nomeB)
  );

  const linhasGuia = (
    <>
      {marcos.map(m => <span key={m.dias} className="regua-marco" style={{ left: `${m.pos}%` }} />)}
      <span className="regua-hoje" style={{ left: `${posHoje}%` }} />
    </>
  );

  return (
    <div className="regua" style={{ '--meses': MESES_NA_REGUA } as React.CSSProperties}>
      <div className="regua-cabecalho" aria-hidden="true">
        <div className="regua-cabecalho-titulo">Contrato e próxima ação</div>
        <div className="regua-escala">
          <div className="regua-meses">
            {meses.map((m, i) => (
              <span key={m.toISOString()} className="regua-mes">
                {format(m, 'LLL', { locale: ptBR }).replace('.', '')}
                {(m.getMonth() === 0 || i === 0) && <small>{format(m, 'yy')}</small>}
              </span>
            ))}
          </div>
          <div className="regua-prazos">
            <span className="regua-prazo-hoje" style={{ left: `${posHoje}%` }}>Hoje</span>
            {marcos.map(m => (
              <span key={m.dias} className="regua-prazo" style={{ left: `${m.pos}%` }}>{m.dias}d</span>
            ))}
          </div>
        </div>
      </div>

      {grupos.map(([nome, lista]) => (
        <section key={nome} aria-label={`${nome}, ${contagem(lista.length)}`}>
          <h2 className="regua-grupo">{nome} <span>{contagem(lista.length)}</span></h2>

          {lista.map(c => {
            const nivel = c.nivelAlerta || 'ok';
            const cfg = NIVEL_ALERTA_CONFIG[nivel];
            const vencimento = parseDataLocal(c.data_vencimento);
            const dias = differenceInDays(vencimento, hoje);
            const prazo = prazoEmTexto(dias, nivel);
            const dataTexto = format(vencimento, 'dd/MM/yyyy');
            const posVencimento = posicao(vencimento);

            const atrasado = dias < 0;
            const esquerda = atrasado ? posVencimento : posHoje;
            const direita = atrasado ? posHoje : posVencimento;
            const passaDaRegua = !atrasado && direita >= 100;
            const etiquetaDentro = direita > LIMITE_ETIQUETA_FORA;

            return (
              <Link
                key={c.id}
                to={`/contrato/${c.id}`}
                className="regua-linha"
                aria-label={`Contrato ${c.numero_contrato}, ${titleCase(c.fornecedor)}. ${cfg.label}. ${prazo}, ${dataTexto}. ${cfg.acaoCurta}.`}
              >
                <div className="regua-contrato">
                  <div className="regua-identificacao">
                    <p className="regua-nome">
                      <span className="regua-numero">{c.numero_contrato}</span> {titleCase(c.fornecedor)}
                    </p>
                    <p className="regua-meta">{formatarMoeda(c.valor_total)}, {atrasado ? 'venceu' : 'vence'} {dataTexto}</p>
                  </div>
                  <div className="regua-acao">
                    <strong className={`nivel-${nivel}`}>{cfg.acaoCurta}</strong>
                    <span>{cfg.label}</span>
                  </div>
                </div>

                <div className="regua-trilha" aria-hidden="true">
                  {linhasGuia}
                  <span
                    className={`regua-barra barra-${nivel} ${atrasado ? 'barra-atrasada' : ''} ${passaDaRegua ? 'barra-continua' : ''}`}
                    style={{ left: `${esquerda}%`, width: `${Math.max(direita - esquerda, 0.6)}%` }}
                  >
                    {etiquetaDentro && <span className="regua-etiqueta-dentro">{prazo}</span>}
                  </span>
                  {!etiquetaDentro && (
                    <span className={`regua-etiqueta nivel-${nivel}`} style={{ left: `${direita}%` }}>{prazo}</span>
                  )}
                </div>
              </Link>
            );
          })}
        </section>
      ))}
    </div>
  );
};
