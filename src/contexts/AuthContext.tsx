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
  signUp: (
    email: string,
    password: string,
    fullName: string,
    mobile: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadProfile(userId: string) {
    try {
      const { data: prof, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) {
        console.error('Profile loading error:', profileError);
      }

      setProfile(prof as Profile | null);

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (roleError) {
        console.error('Role loading error:', roleError);
        setRole('customer');
        return;
      }

      const hasAdminRole = (roles ?? []).some(
        (r) =>
          r.role === 'admin' ||
          r.role === 'super_admin'
      );

      setRole(hasAdminRole ? 'admin' : 'customer');
    } catch (error) {
      console.error('Error loading user profile:', error);
      setProfile(null);
      setRole('customer');
    }
  }

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;

      setSession(data.session);

      if (data.session?.user) {
        loadProfile(data.session.user.id)
          .finally(() => {
            if (mounted) {
              setLoading(false);
            }
          });
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        (async () => {
          setSession(sess);

          if (sess?.user) {
            await loadProfile(sess.user.id);
          } else {
            setProfile(null);
            setRole(null);
          }

          setLoading(false);
        })();
      }
    );

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
    isAdmin: role === 'admin',
    loading,

    async signIn(email, password) {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      return {
        error: error?.message ?? null,
      };
    },

    async signUp(email, password, fullName, mobile) {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            mobile,
          },
        },
      });

      return {
        error: error?.message ?? null,
      };
    },

    async signOut() {
      await supabase.auth.signOut();
      setProfile(null);
      setRole(null);
    },

    async resetPassword(email) {
      const { error } =
        await supabase.auth.resetPasswordForEmail(email);

      return {
        error: error?.message ?? null,
      };
    },

    async refreshProfile() {
      if (session?.user) {
        await loadProfile(session.user.id);
      }
    },
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}