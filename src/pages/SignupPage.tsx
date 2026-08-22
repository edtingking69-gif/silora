import { useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Mail, Lock, User, ArrowRight, Phone } from 'lucide-react';

export function SignupPage() {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mobile, setMobile] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const normalizedMobile = mobile.replace(/\s+/g, '');
    if (!fullName || !email || !password || !confirmPassword || !normalizedMobile) { toast('Please fill all required fields', 'error'); return; }
    if (password.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    if (password !== confirmPassword) { toast('Passwords do not match', 'error'); return; }
    if (!/^[6-9]\d{9}$/.test(normalizedMobile)) { toast('Enter a valid 10-digit Indian mobile number', 'error'); return; }
    setLoading(true);
    const { error } = await signUp(email, password, fullName, normalizedMobile);
    setLoading(false);
    if (error) { toast(error, 'error'); return; }
    toast('Account created! Welcome to SILORA');
    navigate('/account');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link to="/" className="text-3xl font-extrabold tracking-tight text-ink-900">
            SIL<span className="text-primary-600">ORA</span>
          </Link>
          <h1 className="mt-4 text-2xl font-bold text-ink-900">Create Account</h1>
          <p className="mt-1.5 text-sm text-ink-500">Join SILORA and start shopping today</p>
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-6 shadow-card">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="relative">
              <User className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
              <Input label="Full Name *" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="John Doe" className="pl-9" />
            </div>
            <div className="relative">
              <Mail className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
              <Input label="Email *" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className="pl-9" autoComplete="email" />
            </div>
            <div className="relative">
              <Phone className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
              <Input label="Mobile Number *" value={mobile} onChange={(e) => setMobile(e.target.value)} placeholder="9876543210" className="pl-9" maxLength={12} inputMode="numeric" autoComplete="tel" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
              <Input label="Password *" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Min 6 characters" className="pl-9" autoComplete="new-password" />
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-[42px] h-4 w-4 text-ink-400" />
              <Input label="Confirm Password *" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Repeat your password" className="pl-9" autoComplete="new-password" />
            </div>
            <Button type="submit" loading={loading} size="lg" className="w-full">
              Create Account <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-ink-600">
          Already have an account?{' '}
          <Link to="/login" className="font-bold text-primary-600 hover:text-primary-700">Sign in</Link>
        </p>
        <p className="mt-6 text-center text-xs text-ink-400">
          <Link to="/" className="hover:text-ink-600">← Back to SILORA</Link>
        </p>
      </div>
    </div>
  );
}
