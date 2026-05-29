import React from 'react';
import type { ContratoStatus, NivelAlerta } from '../utils/statusUtils';
import { NIVEL_ALERTA_CONFIG } from '../utils/statusUtils';
import './Badge.css';

interface BadgeStatusProps { status: ContratoStatus; }
interface BadgeAlertaProps { nivel: NivelAlerta; }

const statusMap: Record<ContratoStatus, { label: string; className: string }> = {
  ativo:    { label: 'Ativo',    className: 'badge-ativo' },
  vencendo: { label: 'Vencendo', className: 'badge-vencendo' },
  vencido:  { label: 'Vencido',  className: 'badge-vencido' },
  renovado: { label: 'Renovado', className: 'badge-renovado' },
};

export const Badge: React.FC<BadgeStatusProps> = ({ status }) => {
  const { label, className } = statusMap[status] || statusMap.ativo;
  return <span className={`badge ${className}`}>{label}</span>;
};

export const BadgeAlerta: React.FC<BadgeAlertaProps> = ({ nivel }) => {
  const cfg = NIVEL_ALERTA_CONFIG[nivel];
  return <span className={`badge badge-alerta ${cfg.cssClass}`}>{cfg.label}</span>;
};
