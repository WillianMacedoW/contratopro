import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import type { UserRole } from '../contexts/AuthContext';

interface Props {
  children: React.ReactNode;
  requiredRole?: UserRole;
}

export const ProtectedRoute: React.FC<Props> = ({ children, requiredRole }) => {
  const { authUser, loading } = useAuth();

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{
            width: '32px', height: '32px', border: '3px solid var(--border-color)',
            borderTopColor: 'var(--accent-primary)', borderRadius: '50%',
            animation: 'spin 0.8s linear infinite', margin: '0 auto 1rem',
          }} />
          Carregando...
        </div>
      </div>
    );
  }

  if (!authUser) return <Navigate to="/login" replace />;

  if (requiredRole === 'admin' && authUser.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
