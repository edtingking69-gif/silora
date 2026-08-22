import { createClient } from '@supabase/supabase-js';

const runtimeConfig = window.__SILORA_CONFIG__;
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || runtimeConfig?.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || runtimeConfig?.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
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
