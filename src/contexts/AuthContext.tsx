import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

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

  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;

  signUp: (
    email: string,
    password: string,
    fullName: string,
    mobile: string
  ) => Promise<{ error: string | null }>;

  signOut: () => Promise<void>;

  resetPassword: (
    email: string
  ) => Promise<{ error: string | null }>;

  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(
  undefined
);

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
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
        console.error('Profile error:', profileError);
      }

      setProfile((prof as Profile | null) ?? null);

      const { data: roles, error: roleError } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', userId);

      if (roleError) {
        console.error('Role error:', roleError);
      }

      const hasAdminRole =
        roles?.some(
          (item) =>
            item.role === 'admin' ||
            item.role === 'super_admin'
        ) ?? false;

      setRole(hasAdminRole ? 'admin' : 'customer');
    } catch (error) {
      console.error('Error loading user profile:', error);

      setProfile(null);
      setRole('customer');
    }
  }

  useEffect(() => {
    let mounted = true;

    async function initializeAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(session);

      if (session?.user) {
        await loadProfile(session.user.id);
      } else {
        setProfile(null);
        setRole(null);
      }

      if (mounted) {
        setLoading(false);
      }
    }

    initializeAuth();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession);

        if (newSession?.user) {
          await loadProfile(newSession.user.id);
        } else {
          setProfile(null);
          setRole(null);
        }

        if (mounted) {
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
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
      const { error } =
        await supabase.auth.signInWithPassword({
          email,
          password,
        });

      return {
        error: error?.message ?? null,
      };
    },

    async signUp(
      email,
      password,
      fullName,
      mobile
    ) {
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

      setSession(null);
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

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      'useAuth must be used within an AuthProvider'
    );
  }

  return context;
}