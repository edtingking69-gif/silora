import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { supabaseConfigError } from './lib/supabase';

function ConfigurationError({ message }: { message: string }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6 py-12 text-ink-900">
      <section className="w-full max-w-lg rounded-2xl border border-ink-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">SILORA</p>
        <h1 className="mt-3 text-2xl font-bold">Store configuration required</h1>
        <p className="mt-3 text-sm leading-6 text-ink-600">The website loaded, but its public Supabase configuration is not available.</p>
        <p className="mt-4 rounded-xl bg-ink-50 p-4 text-sm font-medium text-ink-700">{message}</p>
        <p className="mt-4 text-sm leading-6 text-ink-600">Set <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> in the Cloudflare build environment, then rebuild and deploy.</p>
      </section>
    </main>
  );
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('SILORA root element is missing.');

createRoot(rootElement).render(
  supabaseConfigError ? <ConfigurationError message={supabaseConfigError} /> : (
    <StrictMode>
      <App />
    </StrictMode>
  )
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
