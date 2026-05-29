import React from 'react';
import './Card.css';

interface CardProps {
  title: string;
  subtitle?: string;
  value: string | number;
  icon: React.ReactNode;
  colorClass?: string;
}

export const Card: React.FC<CardProps> = ({ title, subtitle, value, icon, colorClass = 'card-default' }) => {
  return (
    <div className={`app-card ${colorClass}`}>
      <div className="card-header">
        <div className="card-icon">{icon}</div>
      </div>
      <div className="card-value">{value}</div>
      <div className="card-meta">
        <span className="card-title">{title}</span>
        {subtitle && <span className="card-subtitle">{subtitle}</span>}
      </div>
    </div>
  );
};
