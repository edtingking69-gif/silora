import { createClient } from '@supabase/supabase-js';

function getPublicEnv(name: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const value = import.meta.env[name]?.trim();
  if (!value || value === 'your_anon_key_here' || value === 'your-publishable-key') {
    throw new Error(`Supabase is not configured: ${name} must contain the SILORA public Supabase value.`);
  }
  return value;
}

const supabaseUrl = getPublicEnv('VITE_SUPABASE_URL');
const supabaseAnonKey = getPublicEnv('VITE_SUPABASE_ANON_KEY');

try {
  const parsedUrl = new URL(supabaseUrl);
  if (parsedUrl.protocol !== 'https:' || !parsedUrl.hostname.endsWith('.supabase.co')) {
    throw new Error('VITE_SUPABASE_URL must be the HTTPS URL of the SILORA Supabase project.');
  }
} catch (error) {
  if (error instanceof Error && error.message.startsWith('VITE_SUPABASE_URL')) throw error;
  throw new Error('VITE_SUPABASE_URL must be the HTTPS URL of the SILORA Supabase project.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const STORAGE_BUCKET = 'silora';
export const PAYMENT_PROOF_BUCKET = 'payment-proofs';
