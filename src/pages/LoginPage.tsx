import { useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Lock, ArrowRight } from 'lucide-react';

export function LoginPage() {
  const { signIn, resetPassword } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { toast('Please enter email and password', 'error'); return; }
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    toast('Welcome back!');
    navigate('/account');
  }

  async function handleReset(e: React.FormEvent) {
    e.preventDefault();
    if (!email) { toast('Enter your email first', 'error'); return; }
    setLoading(true);
    const { error } = await resetPassword(email);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    toast('Password reset link sent to your email');
    setShowReset(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold tracking-tight text-ink-900">
            SIL<span className="text-primary-600">ORA</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink-900">{showReset ? 'Reset Password' : 'Welcome Back'}</h1>
          <p className="mt-1.5 text-sm text-ink-500">
            {showReset ? 'Enter your email to receive a reset link' : 'Sign in to your SILORA account'}
          </p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          {!showReset ? (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="relative">
                <Mail className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
                <Input
                  label="Email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="pl-9"
                  autoComplete="email"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
                <Input
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pl-9"
                  autoComplete="current-password"
                />
              </div>
              <button type="button" onClick={() => setShowReset(true)} className="self-end text-xs font-semibold text-primary-600 hover:text-primary-700">
                Forgot password?
              </button>
              <Button type="submit" loading={loading} size="lg" className="w-full">
                Sign In <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          ) : (
            <form onSubmit={handleReset} className="flex flex-col gap-4">
              <Input
                label="Email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
              />
              <Button type="submit" loading={loading} size="lg" className="w-full">Send Reset Link</Button>
              <button type="button" onClick={() => setShowReset(false)} className="text-center text-xs font-semibold text-primary-600">
                Back to login
              </button>
            </form>
          )}
        </div>

        {!showReset && (
          <p className="mt-6 text-center text-sm text-ink-600">
            Don't have an account?{' '}
            <Link to="/signup" className="font-bold text-primary-600 hover:text-primary-700">Sign up</Link>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-ink-400">
          <Link to="/" className="hover:text-ink-600">← Back to SILORA</Link>
        </p>
      </div>
    </div>
  );
}
