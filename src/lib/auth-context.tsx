import type { AuthError, Session, User } from '@supabase/supabase-js';
import { createContext, type ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { migrateLocalDataIfNeeded } from '@/lib/local-migration';
import { supabase } from '@/lib/supabase';

export type AuthResult = { ok: true } | { ok: false; message: string };

export type AuthContextValue = {
  session: Session | null;
  user: User | null;
  /** True until the initial getSession() resolves. */
  loading: boolean;
  signUp: (email: string, password: string) => Promise<AuthResult>;
  signIn: (email: string, password: string) => Promise<AuthResult>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

/** Turn a Supabase AuthError into a short, user-facing sentence. */
function authMessage(error: AuthError): string {
  const m = error.message.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return 'Wrong email or password.';
  }
  if (m.includes('already registered') || m.includes('already been registered')) {
    return 'That email is already registered — try signing in.';
  }
  if (m.includes('password') && m.includes('at least')) {
    return 'Password must be at least 6 characters.';
  }
  if (m.includes('invalid email') || m.includes('unable to validate email')) {
    return 'Enter a valid email address.';
  }
  return error.message;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [initializing, setInitializing] = useState(true);
  // The user id the one-shot first-login migration has settled for (success or
  // logged failure). `loading` stays true until it matches the signed-in user,
  // so the app does not mount and read the stores before pre-auth data is
  // uploaded. Derived — no synchronous setState in the effect.
  const [migratedFor, setMigratedFor] = useState<string | null>(null);

  const userId = session?.user?.id ?? null;
  const loading = initializing || (userId !== null && migratedFor !== userId);

  useEffect(() => {
    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) {
        return;
      }
      setSession(data.session);
      setInitializing(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });
    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId || migratedFor === userId) {
      return;
    }
    let cancelled = false;
    migrateLocalDataIfNeeded(userId)
      .catch((error: unknown) => {
        console.warn('local data migration failed; will retry next sign-in', error);
      })
      .finally(() => {
        if (!cancelled) {
          setMigratedFor(userId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [userId, migratedFor]);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signUp({ email, password });
    return error ? { ok: false, message: authMessage(error) } : { ok: true };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error ? { ok: false, message: authMessage(error) } : { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ session, user: session?.user ?? null, loading, signUp, signIn, signOut }),
    [session, loading, signUp, signIn, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
