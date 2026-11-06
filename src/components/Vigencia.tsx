import React from 'react';
import { differenceInDays, format, startOfDay } from 'date-fns';
import { BadgeAlerta } from './Badge';
import { NIVEL_ALERTA_CONFIG, parseDataLocal, prazoPorExtenso } from '../utils/statusUtils';
import type { NivelAlerta } from '../utils/statusUtils';
import './Vigencia.css';

interface VigenciaProps {
  dataInicio?: string | null;
  dataVencimento: string;
  nivel: NivelAlerta;
}

/** A régua de um contrato só: do início ao vencimento, com a linha de hoje. */
export const Vigencia: React.FC<VigenciaProps> = ({ dataInicio, dataVencimento, nivel }) => {
  const cfg = NIVEL_ALERTA_CONFIG[nivel];
  const hoje = startOfDay(new Date());
  const vencimento = parseDataLocal(dataVencimento);
  const inicio = dataInicio ? parseDataLocal(dataInicio) : null;
  const dias = differenceInDays(vencimento, hoje);

  const total = inicio ? differenceInDays(vencimento, inicio) : 0;
  const decorrido = inicio && total > 0
    ? Math.min(100, Math.max(0, (differenceInDays(hoje, inicio) / total) * 100))
    : null;

  return (
    <section className="vigencia" aria-label="Vigência do contrato">
      <div className="vigencia-topo">
        <p className={`vigencia-prazo nivel-${nivel}`}>{prazoPorExtenso(dias, nivel)}</p>
        <BadgeAlerta nivel={nivel} />
      </div>

      {decorrido !== null && (
        <div className="vigencia-trilha" aria-hidden="true">
          <span className={`vigencia-decorrido barra-${nivel}`} style={{ width: `${decorrido}%` }} />
          {decorrido < 100 && <span className="vigencia-hoje" style={{ left: `${decorrido}%` }} />}
        </div>
      )}

      <div className="vigencia-datas">
        <span>Início {inicio ? format(inicio, 'dd/MM/yyyy') : 'não informado'}</span>
        <span>Vencimento {format(vencimento, 'dd/MM/yyyy')}</span>
      </div>

      <p className="vigencia-acao"><strong>Próxima ação:</strong> {cfg.acao}</p>
    </section>
  );
};
