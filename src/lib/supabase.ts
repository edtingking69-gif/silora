import { createClient } from '@supabase/supabase-js';

const FALLBACK_SUPABASE_URL = 'https://configuration.invalid';
const FALLBACK_SUPABASE_ANON_KEY = 'configuration-missing-anon-key';

function getPublicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | null {
  const value = import.meta.env[name]?.trim();
  if (!value || value === 'your_anon_key_here' || value === 'your-publishable-key') {
    return null;
  }
  return value;
}

const configuredSupabaseUrl = getPublicEnv('VITE_SUPABASE_URL');
const configuredSupabaseAnonKey = getPublicEnv('VITE_SUPABASE_ANON_KEY');
const hasValidSupabaseUrl = configuredSupabaseUrl ? (() => {
  try {
    const parsedUrl = new URL(configuredSupabaseUrl);
    return parsedUrl.protocol === 'https:' && parsedUrl.hostname.endsWith('.supabase.co');
  } catch {
    return false;
  }
})() : false;

export const supabaseConfigError = !configuredSupabaseUrl
  ? 'Supabase is not configured: VITE_SUPABASE_URL is missing from the production build environment.'
  : !hasValidSupabaseUrl
    ? 'Supabase is not configured: VITE_SUPABASE_URL must be the HTTPS URL of the SILORA Supabase project.'
  : !configuredSupabaseAnonKey
    ? 'Supabase is not configured: VITE_SUPABASE_ANON_KEY is missing from the production build environment.'
    : null;

const supabaseUrl = configuredSupabaseUrl ?? FALLBACK_SUPABASE_URL;
const supabaseAnonKey = configuredSupabaseAnonKey ?? FALLBACK_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORAGE_BUCKET = 'silora';
export const PAYMENT_PROOF_BUCKET = 'payment-proofs';
