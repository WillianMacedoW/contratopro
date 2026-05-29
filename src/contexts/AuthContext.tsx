import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

export type UserRole = 'admin' | 'visualizador';

interface AuthUser {
  user: User;
  role: UserRole;
  nome: string;
}

interface AuthContextValue {
  authUser: AuthUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const carregarPerfil = async (user: User): Promise<AuthUser> => {
    try {
      const { data } = await Promise.race([
        supabase.from('profiles').select('role, nome').eq('id', user.id).maybeSingle(),
        new Promise<{ data: null }>((resolve) => setTimeout(() => resolve({ data: null }), 3000)),
      ]);
      return {
        user,
        role: (data?.role as UserRole) || 'visualizador',
        nome: data?.nome || user.email?.split('@')[0] || 'Usuário',
      };
    } catch {
      return { user, role: 'visualizador', nome: user.email?.split('@')[0] || 'Usuário' };
    }
  };

  useEffect(() => {
    // Timeout de segurança — nunca fica travado mais de 5s
    const timer = setTimeout(() => setLoading(false), 5000);

    supabase.auth.getSession().then(async ({ data: { session } }: any) => {
      try {
        if (session?.user) {
          setAuthUser(await carregarPerfil(session.user));
        }
      } catch {
        // perfil não carregou — continua sem travar
      } finally {
        clearTimeout(timer);
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event: string, session: Session | null) => {
        try {
          if (session?.user) {
            setAuthUser(await carregarPerfil(session.user));
          } else {
            setAuthUser(null);
          }
        } catch {
          setAuthUser(null);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return error.message;
    if (data.user) {
      const perfil = await carregarPerfil(data.user);
      setAuthUser(perfil);
    }
    return null;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAuthUser(null);
  };

  return (
    <AuthContext.Provider value={{ authUser, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth fora do AuthProvider');
  return ctx;
};
