import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle2, AlertTriangle, Play } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { verificarConexaoSupabase } from '../lib/supabase';
import { Logo } from '../components/Logo';

export const Login: React.FC = () => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [erro, setErro] = useState('');
  const [loading, setLoading] = useState(false);
  const [estaOnline, setEstaOnline] = useState<boolean | null>(null);

  useEffect(() => {
    verificarConexaoSupabase().then((online) => {
      setEstaOnline(online);
    });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setLoading(true);
    const msg = await signIn(email, password);
    if (msg) {
      setErro('E-mail ou senha incorretos.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleEntrarModoDemo = async () => {
    setErro('');
    setLoading(true);
    localStorage.setItem('cp_use_mock', 'true');
    const msg = await signIn('admin@contratopro.com', 'admin123');
    if (msg) {
      setErro('Erro ao entrar no Modo Demo.');
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  const handleForcarConexaoReal = async () => {
    localStorage.setItem('cp_use_mock', 'false');
    setLoading(true);
    const online = await verificarConexaoSupabase();
    setEstaOnline(online);
    setLoading(false);
    if (!online) {
      setErro('Não foi possível conectar ao banco de dados online.');
      localStorage.setItem('cp_use_mock', 'true');
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      background: 'var(--bg-base)',
    }}>
      {/* Painel lateral de marca */}
      <div style={{
        width: '420px',
        minHeight: '100vh',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '3rem',
        flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
          <Logo />
          <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-high)' }}>
            ContratoPro
          </span>
        </div>

        <div>
          <p style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-high)', lineHeight: 1.4, marginBottom: '1rem' }}>
            Gestão inteligente de contratos públicos
          </p>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', lineHeight: 1.65 }}>
            Monitore vencimentos, verifique fornecedores e mantenha sua secretaria em conformidade.
          </p>
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-low)' }}>
          Secretaria Municipal · Acesso restrito
        </p>
      </div>

      {/* Formulário */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2rem',
      }}>
        <div style={{ width: '100%', maxWidth: '360px' }}>
          {/* Indicador de Status de Conexão Premium */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 0.75rem',
            borderRadius: '999px',
            background: estaOnline ? 'var(--green-dim)' : 'var(--amber-dim)',
            border: `1px solid ${estaOnline ? 'var(--green-border)' : 'var(--amber-border)'}`,
            width: 'fit-content',
            marginBottom: '1.5rem',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: estaOnline ? 'var(--green)' : 'var(--amber)',
          }}>
            {estaOnline === null ? (
              <Loader2 size={12} className="spin" />
            ) : estaOnline ? (
              <CheckCircle2 size={12} />
            ) : (
              <AlertTriangle size={12} />
            )}
            {estaOnline === null ? (
              'Verificando conexão...'
            ) : estaOnline ? (
              <span>Banco de Dados Online Conectado</span>
            ) : (
              <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Modo Demonstração Ativo (Local)
                {localStorage.getItem('cp_use_mock') === 'false' && (
                  <button onClick={handleForcarConexaoReal} style={{ background: 'none', border: 'none', color: 'var(--accent)', textDecoration: 'underline', cursor: 'pointer', fontSize: '0.75rem', padding: 0 }}>Reconectar</button>
                )}
              </span>
            )}
          </div>

          <h1 style={{
            fontSize: '1.5rem',
            fontWeight: 800,
            color: 'var(--text-high)',
            marginBottom: '0.375rem',
            letterSpacing: '-0.02em',
          }}>
            Entrar na plataforma
          </h1>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-mid)', marginBottom: '2rem' }}>
            Use suas credenciais institucionais
          </p>

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">E-mail ou Usuário</label>
              <input
                className="form-input"
                type="text"
                placeholder="seu@email.com ou admin"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="form-group">
              <label className="form-label">Senha</label>
              <input
                className="form-input"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>

            {erro && (
              <div style={{
                background: 'var(--red-dim)',
                color: 'var(--red)',
                border: '1px solid var(--red-border)',
                borderRadius: 'var(--radius-md)',
                padding: '0.625rem 0.75rem',
                fontSize: '0.875rem',
                marginBottom: '1rem',
              }}>
                {erro}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary"
              disabled={loading}
              style={{ width: '100%', justifyContent: 'center', padding: '0.6875rem', fontSize: '0.9375rem', marginTop: '0.25rem' }}
            >
              {loading ? <Loader2 size={16} className="spin" /> : null}
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>

          {/* Divisor elegante */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            margin: '1.5rem 0',
            color: 'var(--text-low)',
            fontSize: '0.75rem',
          }}>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
            <span style={{ padding: '0 0.75rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>ou</span>
            <div style={{ flex: 1, height: '1px', background: 'var(--border)' }}></div>
          </div>

          {/* Botão Premium Failsafe do Modo Demo */}
          <button
            onClick={handleEntrarModoDemo}
            disabled={loading}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.5rem',
              padding: '0.6875rem',
              fontSize: '0.9375rem',
              borderRadius: 'var(--radius-md)',
              border: '1px dashed var(--accent-border)',
              background: 'var(--accent-dim)',
              color: 'var(--accent)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'rgba(31, 95, 214, 0.16)';
              e.currentTarget.style.borderStyle = 'solid';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'var(--accent-dim)';
              e.currentTarget.style.borderStyle = 'dashed';
            }}
          >
            {loading ? <Loader2 size={16} className="spin" /> : <Play size={14} fill="var(--accent)" />}
            Entrar no Modo Demonstração (Local)
          </button>
        </div>
      </div>
    </div>

  );
};
