import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ImportProvider, useImport } from './contexts/ImportContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Sidebar } from './components/Sidebar';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { ContratosList } from './pages/ContratosList';
import { ContratoForm } from './pages/ContratoForm';
import { ContratoDetail } from './pages/ContratoDetail';
import { Conformidade } from './pages/Conformidade';

const ImportBanner = () => {
  const { importStatus, limparStatus } = useImport();
  if (importStatus.fase === 'ocioso') return null;

  const cores: Record<string, string> = {
    buscando: '#2563eb', secretarias: '#2563eb', salvando: '#2563eb',
    concluido: '#059669', erro: '#dc2626',
  };
  const cor = cores[importStatus.fase] || '#2563eb';
  const ativo = importStatus.fase !== 'concluido' && importStatus.fase !== 'erro';

  return (
    <div style={{
      position: 'fixed', bottom: '1.5rem', right: '1.5rem', zIndex: 9999,
      background: '#1e293b', border: `2px solid ${cor}`, borderRadius: '0.75rem',
      padding: '0.875rem 1.25rem', maxWidth: '360px', boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem', marginBottom: ativo && importStatus.total > 0 ? '0.5rem' : 0 }}>
        {ativo && (
          <div style={{
            width: '14px', height: '14px', borderRadius: '50%',
            border: `2px solid ${cor}`, borderTopColor: 'transparent',
            animation: 'spin 0.8s linear infinite', flexShrink: 0,
          }} />
        )}
        <span style={{ fontSize: '0.8rem', color: cor === '#dc2626' ? '#fca5a5' : cor === '#059669' ? '#6ee7b7' : '#93c5fd', fontWeight: 600 }}>
          Importação PNCP
        </span>
        {!ativo && (
          <button onClick={limparStatus} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1rem', lineHeight: 1 }}>✕</button>
        )}
      </div>
      <p style={{ fontSize: '0.775rem', color: '#cbd5e1', margin: 0, marginBottom: ativo && importStatus.total > 0 ? '0.5rem' : 0 }}>
        {importStatus.mensagem}
      </p>
      {ativo && importStatus.total > 0 && (
        <div style={{ height: '4px', background: '#334155', borderRadius: '999px', overflow: 'hidden' }}>
          <div style={{
            height: '100%', background: cor, borderRadius: '999px',
            width: `${Math.min(100, (importStatus.progresso / importStatus.total) * 100)}%`,
            transition: 'width 0.3s ease',
          }} />
        </div>
      )}
    </div>
  );
};

const AppLayout = () => {
  const { authUser } = useAuth();
  const isAdmin = authUser?.role === 'admin';

  return (
    <div className="app-container">
      <Sidebar />
      <main className="main-content">
        <Routes>
          <Route path="/"                    element={<Dashboard />} />
          <Route path="/contratos"           element={<ContratosList />} />
          <Route path="/contrato/:id"        element={<ContratoDetail />} />
          <Route path="/conformidade"        element={<Conformidade />} />
          {/* Rotas somente admin */}
          <Route path="/contrato/novo"       element={isAdmin ? <ContratoForm /> : <Navigate to="/" replace />} />
          <Route path="/contrato/:id/editar" element={isAdmin ? <ContratoForm /> : <Navigate to="/" replace />} />
          <Route path="/importar"            element={isAdmin ? <ContratoForm isImportMode={true} /> : <Navigate to="/" replace />} />
        </Routes>
      </main>
      <ImportBanner />
    </div>
  );
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <ImportProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/*" element={
              <ProtectedRoute>
                <AppLayout />
              </ProtectedRoute>
            } />
          </Routes>
        </ImportProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
