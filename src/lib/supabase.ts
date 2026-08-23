import { createClient } from '@supabase/supabase-js';

function getPublicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string | null {
  const value = import.meta.env[name]?.trim();
  if (!value || value === 'your_anon_key_here' || value === 'your-publishable-key') {
    return null;
  }
  return value;
}

const supabaseUrl = getPublicEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getPublicEnv('VITE_SUPABASE_ANON_KEY');

let supabaseConfigError: string | null = null;
if (!supabaseUrl) {
  supabaseConfigError = 'VITE_SUPABASE_URL is missing.';
} else if (!supabaseAnonKey) {
  supabaseConfigError = 'VITE_SUPABASE_ANON_KEY is missing or still uses a placeholder value.';
} else {
  try {
    const parsedUrl = new URL(supabaseUrl);
    if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
      supabaseConfigError = 'VITE_SUPABASE_URL must be the HTTPS URL of the SILORA Supabase project.';
    }
  } catch {
    supabaseConfigError = 'VITE_SUPABASE_URL must be a valid HTTPS URL.';
  }
}

export { supabaseConfigError };

export const supabase = createClient(supabaseUrl ?? 'https://invalid.supabase.co', supabaseAnonKey ?? 'invalid-anon-key', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORAGE_BUCKET = 'silora';
export const PAYMENT_PROOF_BUCKET = 'payment-proofs';
