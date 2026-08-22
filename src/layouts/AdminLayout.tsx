import { useEffect, useState, type ReactNode } from 'react';
import { Link, navigate, useRoute } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { classNames } from '@/utils/format';
import {
  LayoutDashboard, ShoppingCart, Package, Tag, CreditCard, Users,
  UserCog, QrCode, Truck, Ticket, Settings, LogOut, Menu, X,
  Home as HomeIcon, MoreHorizontal, ShieldCheck, AlertCircle, TrendingUp,
} from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard, group: 'main' },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingCart, group: 'main' },
  { label: 'Products', path: '/admin/products', icon: Package, group: 'main' },
  { label: 'Categories', path: '/admin/categories', icon: Tag, group: 'main' },
  { label: 'Payments', path: '/admin/payments', icon: CreditCard, group: 'main' },
  { label: 'Customers', path: '/admin/customers', icon: Users, group: 'more' },
  { label: 'Admins', path: '/admin/admins', icon: UserCog, group: 'more' },
  { label: 'Payment Methods', path: '/admin/payment-methods', icon: CreditCard, group: 'more' },
  { label: 'QR Codes', path: '/admin/qr-codes', icon: QrCode, group: 'more' },
  { label: 'Shipping', path: '/admin/shipping', icon: Truck, group: 'more' },
  { label: 'Coupons', path: '/admin/coupons', icon: Ticket, group: 'more' },
  { label: 'Settings', path: '/admin/settings', icon: Settings, group: 'more' },
];

const MOBILE_MAIN = [
  { label: 'Dashboard', path: '/admin/dashboard', icon: LayoutDashboard },
  { label: 'Orders', path: '/admin/orders', icon: ShoppingCart },
  { label: 'Products', path: '/admin/products', icon: Package },
];

export function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isAdmin, loading, signOut, profile } = useAuth();
  const route = useRoute();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  useEffect(() => {
    setSidebarOpen(false);
    setMoreOpen(false);
  }, [route]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 rounded-xl border-2 border-primary-200 border-t-primary-600 animate-spin" />
          <p className="text-sm text-ink-500">Loading admin panel...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AdminLogin />;
  }

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink-50 px-4">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-error-50 text-error-500">
            <ShieldCheck className="h-8 w-8" />
          </div>
          <h1 className="text-xl font-bold text-ink-900">Access Denied — Administrator access required.</h1>
          <p className="mt-2 text-sm text-ink-500">You don't have admin privileges. This area is restricted to authorized administrators only.</p>
          <div className="mt-6 flex gap-3 justify-center">
            <Link to="/" className="rounded-xl border border-ink-300 bg-white px-5 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50">Go to Store</Link>
            <Button onClick={() => signOut().then(() => navigate('/admin'))}>Sign Out</Button>
          </div>
        </div>
      </div>
    );
  }

  const currentPath = route.split('?')[0];
  const activeItem = NAV_ITEMS.find((item) => currentPath === item.path);
  const isMoreActive = NAV_ITEMS.some((item) => item.group === 'more' && currentPath === item.path);

  return (
    <div className="min-h-screen bg-ink-50 flex">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-ink-200 bg-white">
        <div className="flex h-16 items-center gap-2 border-b border-ink-100 px-5">
          <span className="text-xl font-extrabold tracking-tight text-ink-900">SIL<span className="text-primary-600">ORA</span></span>
          <span className="ml-auto rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-700">Admin</span>
        </div>
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5">
          {NAV_ITEMS.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={classNames(
                'flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors',
                currentPath === item.path ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
              )}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="border-t border-ink-100 p-3">
          <div className="mb-2 flex items-center gap-2 px-3 py-1.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
              {(profile?.full_name ?? user.email ?? 'A').charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-ink-900">{profile?.full_name ?? 'Admin'}</p>
              <p className="truncate text-xs text-ink-500">{user.email}</p>
            </div>
          </div>
          <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">
            <HomeIcon className="h-4 w-4" /> View Store
          </Link>
          <button onClick={() => signOut().then(() => navigate('/admin'))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-error-600 hover:bg-error-50">
            <LogOut className="h-4 w-4" /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setSidebarOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white shadow-card-hover animate-slide-up">
            <div className="flex h-16 items-center justify-between border-b border-ink-100 px-5">
              <span className="text-xl font-extrabold tracking-tight text-ink-900">SIL<span className="text-primary-600">ORA</span></span>
              <button onClick={() => setSidebarOpen(false)} className="rounded-lg p-2 hover:bg-ink-100"><X className="h-5 w-5" /></button>
            </div>
            <nav className="p-3 space-y-0.5 overflow-y-auto" style={{ maxHeight: 'calc(100% - 64px)' }}>
              {NAV_ITEMS.map((item) => (
                <Link key={item.path} to={item.path} className={classNames('flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium', currentPath === item.path ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-100')}>
                  <item.icon className="h-5 w-5" /> {item.label}
                </Link>
              ))}
              <div className="my-2 border-t border-ink-100" />
              <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100"><HomeIcon className="h-5 w-5" /> View Store</Link>
              <button onClick={() => signOut().then(() => navigate('/admin'))} className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-error-600 hover:bg-error-50"><LogOut className="h-5 w-5" /> Logout</button>
            </nav>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="lg:hidden sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-ink-200 bg-white px-4">
          <button onClick={() => setSidebarOpen(true)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100"><Menu className="h-5 w-5" /></button>
          <span className="text-lg font-extrabold tracking-tight text-ink-900">SIL<span className="text-primary-600">ORA</span></span>
          <span className="ml-auto rounded-md bg-primary-100 px-2 py-0.5 text-[10px] font-bold uppercase text-primary-700">Admin</span>
        </header>

        {/* Desktop header */}
        <header className="hidden lg:flex sticky top-0 z-30 h-16 items-center gap-4 border-b border-ink-200 bg-white px-6">
          <h1 className="text-lg font-bold text-ink-900">{activeItem?.label ?? 'Admin'}</h1>
          <div className="ml-auto flex items-center gap-2">
            <Link to="/" className="rounded-xl px-3 py-2 text-sm font-medium text-ink-600 hover:bg-ink-100">View Store</Link>
          </div>
        </header>

        <main className="flex-1 p-4 pb-20 lg:p-6 lg:pb-6">
          {children}
        </main>
      </div>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 h-14">
          {MOBILE_MAIN.map((item) => (
            <Link key={item.path} to={item.path} className="flex flex-col items-center justify-center gap-0.5" activeClass="text-primary-600">
              <item.icon className="h-5 w-5 text-ink-600" />
              <span className="text-[10px] font-semibold text-ink-600">{item.label}</span>
            </Link>
          ))}
          <Link to="/admin/payments" className="flex flex-col items-center justify-center gap-0.5" activeClass="text-primary-600">
            <CreditCard className="h-5 w-5 text-ink-600" />
            <span className="text-[10px] font-semibold text-ink-600">Payments</span>
          </Link>
          <button onClick={() => setMoreOpen(true)} className={classNames('flex flex-col items-center justify-center gap-0.5', isMoreActive && 'text-primary-600')}>
            <MoreHorizontal className="h-5 w-5 text-ink-600" />
            <span className="text-[10px] font-semibold text-ink-600">More</span>
          </button>
        </div>
      </nav>

      {/* More sheet */}
      {moreOpen && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setMoreOpen(false)} />
          <div className="absolute bottom-0 left-0 right-0 rounded-t-2xl bg-white p-5 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">More</h2>
              <button onClick={() => setMoreOpen(false)} className="rounded-lg p-2 hover:bg-ink-100"><X className="h-5 w-5" /></button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              {NAV_ITEMS.filter((i) => i.group === 'more').map((item) => (
                <Link key={item.path} to={item.path} className="flex flex-col items-center gap-2 rounded-xl border border-ink-100 p-4 text-center hover:bg-ink-50">
                  <item.icon className="h-6 w-6 text-primary-600" />
                  <span className="text-xs font-semibold text-ink-800">{item.label}</span>
                </Link>
              ))}
              <Link to="/" className="flex flex-col items-center gap-2 rounded-xl border border-ink-100 p-4 text-center hover:bg-ink-50">
                <HomeIcon className="h-6 w-6 text-ink-600" />
                <span className="text-xs font-semibold text-ink-800">Store</span>
              </Link>
              <button onClick={() => signOut().then(() => navigate('/admin'))} className="flex flex-col items-center gap-2 rounded-xl border border-ink-100 p-4 text-center hover:bg-error-50">
                <LogOut className="h-6 w-6 text-error-600" />
                <span className="text-xs font-semibold text-error-600">Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AdminLogin() {
  const { signIn, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSent, setForgotSent] = useState(false);
  const [forgotLoading, setForgotLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) return;
    setError('');
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) {
      setError(error);
      return;
    }
    navigate('/admin/dashboard');
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    if (!forgotEmail.trim()) return;
    setForgotLoading(true);
    const { error } = await resetPassword(forgotEmail);
    setForgotLoading(false);
    if (error) {
      setError(error);
      return;
    }
    setForgotSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-ink-900 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 shadow-lg shadow-primary-600/30">
            <ShieldCheck className="h-8 w-8 text-white" />
          </div>
          <span className="text-3xl font-extrabold tracking-tight text-white">SIL<span className="text-primary-500">ORA</span></span>
          <div className="mt-3 inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-4 py-1.5 text-sm font-semibold text-primary-400 ring-1 ring-primary-500/20">
            Admin Portal
          </div>
        </div>

        <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
          {forgotMode ? (
            <>
              <h1 className="text-xl font-bold text-ink-900 mb-1">Reset Password</h1>
              <p className="text-sm text-ink-500 mb-5">Enter your email and we'll send you a reset link.</p>

              {forgotSent ? (
                <div className="rounded-xl bg-success-50 p-4 text-center">
                  <p className="text-sm font-semibold text-success-700">Reset link sent!</p>
                  <p className="mt-1 text-xs text-success-600">Check your email for instructions.</p>
                  <button onClick={() => { setForgotMode(false); setForgotSent(false); }} className="mt-3 text-sm font-semibold text-primary-600 hover:text-primary-700">Back to Login</button>
                </div>
              ) : (
                <form onSubmit={handleForgot} className="flex flex-col gap-4">
                  <Input label="Email" type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} placeholder="admin@silora.in" autoComplete="email" />
                  {error && <p className="text-sm text-error-600">{error}</p>}
                  <Button type="submit" loading={forgotLoading} size="lg" className="w-full">Send Reset Link</Button>
                  <button type="button" onClick={() => { setForgotMode(false); setError(''); }} className="text-sm font-semibold text-primary-600 hover:text-primary-700">Back to Login</button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-xl font-bold text-ink-900 mb-1">Admin Login</h1>
              <p className="text-sm text-ink-500 mb-5">Sign in with your admin credentials</p>

              {error && (
                <div className="mb-4 rounded-xl bg-error-50 p-3 text-sm text-error-700">{error}</div>
              )}

              <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@silora.in" autoComplete="email" />
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter your password" autoComplete="current-password" />
                <button type="submit" disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary-600 text-base font-bold text-white transition-colors hover:bg-primary-700 disabled:opacity-60">
                  {loading ? <span className="h-5 w-5 rounded-full border-2 border-white/30 border-t-white animate-spin" /> : 'Sign In'}
                </button>
              </form>

              <button onClick={() => { setForgotMode(true); setError(''); }} className="mt-4 block w-full text-center text-sm font-semibold text-primary-600 hover:text-primary-700">
                Forgot Password?
              </button>

              <div className="mt-5 flex items-start gap-2 rounded-xl bg-warning-50 p-3">
                <AlertCircle className="h-4 w-4 shrink-0 text-warning-600 mt-0.5" />
                <p className="text-xs text-warning-700">Admin access is restricted. Only users with the admin role can access this panel. Customers cannot self-assign admin privileges.</p>
              </div>
            </>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-ink-400">
          <Link to="/" className="hover:text-white">← Back to SILORA Store</Link>
        </p>
      </div>
    </div>
  );
}
