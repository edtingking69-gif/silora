import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Profile, UserRole } from '@/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  role: UserRole | null;
  isAdmin: boolean;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string, mobile: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function formatSignInError(message: string | undefined): string | null {
  if (!message) return null;
  const normalized = message.toLowerCase();
  if (normalized.includes('invalid login credentials') || normalized.includes('invalid email or password')) {
    return 'Invalid email or password';
  }
  return message;
}

function formatAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? '');
  if (message.toLowerCase().includes('failed to fetch')) {
    return 'Unable to reach Supabase. Check the Cloudflare VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY build variables, then redeploy.';
  }
  return message || 'Authentication failed. Please try again.';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    const { data: prof } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    setProfile(prof as Profile | null);

    // Ask the backend for the user's role. get_user_role returns 'super_admin', 'admin', or 'customer'.
    const { data: roleData, error: roleError } = await supabase.rpc('get_user_role');
    if (roleError) throw roleError;
    const resolvedRole = Array.isArray(roleData) ? (roleData[0] as any) : roleData;
    // rpc may return plain text or a single-row; normalize to string
    const roleText = typeof resolvedRole === 'string' ? resolvedRole : (resolvedRole?.get_user_role ?? resolvedRole?.role ?? null);
    if (roleText === 'super_admin') setRole('super_admin');
    else if (roleText === 'admin') setRole('admin');
    else setRole('customer');
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession()
      .then(({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        if (data.session?.user) {
          loadProfile(data.session.user.id)
            .catch((error) => console.error('SILORA profile initialization failed', error))
            .finally(() => mounted && setLoading(false));
        } else {
          setLoading(false);
        }
      })
      .catch((error) => {
        console.error('SILORA authentication initialization failed', error);
        if (mounted) setLoading(false);
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      (async () => {
        setSession(sess);
        if (sess?.user) {
          try {
            await loadProfile(sess.user.id);
          } catch (error) {
            console.error('SILORA profile refresh failed', error);
          }
        } else {
          setProfile(null);
          setRole(null);
        }
        setLoading(false);
      })();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextValue = {
    session,
    user: session?.user ?? null,
    profile,
    role,
    isAdmin: role === 'admin' || role === 'super_admin',
    loading,
    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      return { error: formatSignInError(error?.message) };
    },
    async signUp(email, password, fullName, mobile) {
      try {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName, mobile } },
        });
        return { error: error ? formatAuthError(error) : null };
      } catch (error) {
        return { error: formatAuthError(error) };
      }
    },
    async signOut() {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
    },
    async resetPassword(email) {
      const { error } = await supabase.auth.resetPasswordForEmail(email);
      return { error: error?.message ?? null };
    },
    async refreshProfile() {
      if (session?.user) await loadProfile(session.user.id);
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
