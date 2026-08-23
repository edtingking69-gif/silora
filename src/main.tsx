import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react';
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

interface ErrorBoundaryState {
  error: Error | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('SILORA application error', error, errorInfo);
  }

  render() {
    if (this.state.error) {
      return (
        <main className="flex min-h-screen items-center justify-center bg-ink-50 px-6 py-12 text-ink-900">
          <section className="w-full max-w-lg rounded-2xl border border-error-200 bg-white p-8 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary-600">SILORA</p>
            <h1 className="mt-3 text-2xl font-bold">The store could not load</h1>
            <p className="mt-3 text-sm leading-6 text-ink-600">A temporary application error prevented this page from rendering. Reload the page and try again.</p>
            <p className="mt-4 rounded-xl bg-error-50 p-4 text-sm font-medium text-error-700">{this.state.error.message || 'Unexpected application error'}</p>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">Reload SILORA</button>
          </section>
        </main>
      );
    }
    return this.props.children;
  }
}

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('SILORA root element is missing.');

createRoot(rootElement).render(
  <AppErrorBoundary>
    {supabaseConfigError ? <ConfigurationError message={supabaseConfigError} /> : (
      <StrictMode>
        <App />
      </StrictMode>
    )}
  </AppErrorBoundary>
);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
