import { useEffect, useState, type ReactNode } from 'react';
import { Grid3x3, Home, Menu, Search, ShoppingCart, User, X } from 'lucide-react';
import { Link, navigate, useRoute } from '@/components/router/Router';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useSecretAdminTap } from '@/hooks/useSecretAdminTap';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';

export function StoreLayout({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const { user, profile } = useAuth();
  const route = useRoute();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const onLogoTap = useSecretAdminTap(5, 2000);

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await supabase.from('categories').select('*').eq('is_active', true).order('display_order');
        setCategories((data as Category[]) ?? []);
      } catch (error) {
        console.error('SILORA category navigation failed', error);
      }
    })();
  }, []);

  useEffect(() => setMobileMenu(false), [route]);

  function handleSearch(event: React.FormEvent) {
    event.preventDefault();
    if (searchQuery.trim()) navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
  }

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'All Products', path: '/products' },
    { label: 'Categories', path: '/categories' },
    ...categories.slice(0, 4).map((category) => ({ label: category.name, path: `/products?category=${category.slug}` })),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      <div className="bg-ink-900 px-4 py-2 text-center text-xs font-medium text-white">Free shipping on all orders — No minimum order value!</div>
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/90 backdrop-blur-lg">
        <div className="container-silora">
          <div className="flex h-16 items-center gap-3">
            <button className="rounded-lg p-2 text-ink-700 hover:bg-ink-100 lg:hidden" onClick={() => setMobileMenu(true)} aria-label="Menu"><Menu className="h-5 w-5" /></button>
            <Link to="/" onClick={onLogoTap} className="shrink-0 select-none text-2xl font-extrabold tracking-tight text-ink-900">SIL<span className="text-primary-600">ORA</span></Link>
            <form onSubmit={handleSearch} className="mx-4 hidden max-w-xl flex-1 md:flex">
              <input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products, categories..." className="h-10 w-full rounded-l-xl border border-r-0 border-ink-300 bg-ink-50 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
              <button type="submit" className="flex h-10 items-center rounded-r-xl bg-primary-600 px-4 text-white"><Search className="h-4 w-4" /></button>
            </form>
            <div className="ml-auto flex items-center gap-1">
              <Link to="/account" className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"><User className="h-5 w-5" /><span className="hidden sm:inline">{user ? (profile?.full_name?.split(' ')[0] || 'Account') : 'Login'}</span></Link>
              <Link to="/cart" className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 hover:bg-ink-100"><ShoppingCart className="h-5 w-5" /><span className="hidden sm:inline">Cart</span>{count > 0 && <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">{count}</span>}</Link>
            </div>
          </div>
          <nav className="hidden h-11 items-center gap-1 lg:flex">{navLinks.map((link) => <Link key={link.path} to={link.path} className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 hover:bg-ink-100 hover:text-ink-900" activeClass="bg-primary-50 text-primary-700">{link.label}</Link>)}</nav>
        </div>
        <form onSubmit={handleSearch} className="border-t border-ink-100 px-4 py-2.5 md:hidden"><div className="flex"><input type="search" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search products..." className="h-10 w-full rounded-l-xl border border-r-0 border-ink-300 bg-ink-50 px-4 text-sm" /><button type="submit" className="rounded-r-xl bg-primary-600 px-4 text-white"><Search className="h-4 w-4" /></button></div></form>
      </header>
      {mobileMenu && <div className="fixed inset-0 z-[60] lg:hidden"><div className="absolute inset-0 bg-ink-950/50" onClick={() => setMobileMenu(false)} /><div className="absolute left-0 top-0 h-full w-72 max-w-[85%] overflow-y-auto bg-white p-4"><div className="mb-6 flex items-center justify-between"><Link to="/" onClick={onLogoTap} className="text-xl font-extrabold text-ink-900">SIL<span className="text-primary-600">ORA</span></Link><button onClick={() => setMobileMenu(false)} aria-label="Close menu"><X className="h-5 w-5" /></button></div><nav className="flex flex-col gap-1">{navLinks.map((link) => <Link key={link.path} to={link.path} className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100">{link.label}</Link>)}</nav></div></div>}
      <main className="flex-1">{children}</main>
      <footer className="border-t border-ink-200 bg-ink-900 text-ink-300"><div className="container-silora py-12"><div className="grid grid-cols-2 gap-8 md:grid-cols-5"><div className="col-span-2"><span className="text-2xl font-extrabold text-white">SIL<span className="text-primary-500">ORA</span></span><p className="mt-3 max-w-xs text-sm text-ink-400">India's premium multi-category online store. Shop fashion, electronics, home, beauty and more at the best prices.</p></div><div><h4 className="mb-3 text-sm font-bold text-white">Shop</h4><Link to="/products" className="block text-sm hover:text-white">All Products</Link><Link to="/categories" className="block text-sm hover:text-white">Categories</Link><Link to="/cart" className="block text-sm hover:text-white">Cart</Link></div><div><h4 className="mb-3 text-sm font-bold text-white">Account</h4><Link to="/account" className="block text-sm hover:text-white">My Account</Link><Link to="/account/orders" className="block text-sm hover:text-white">My Orders</Link><Link to="/login" className="block text-sm hover:text-white">Login</Link></div><div><h4 className="mb-3 text-sm font-bold text-white">About</h4><Link to="/about" className="block text-sm hover:text-white">About SILORA</Link><Link to="/contact" className="block text-sm hover:text-white">Contact</Link><Link to="/privacy" className="block text-sm hover:text-white">Privacy</Link><Link to="/terms" className="block text-sm hover:text-white">Terms</Link></div></div></div></footer>
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200 bg-white/95 lg:hidden"><div className="grid h-14 grid-cols-5"><Link to="/" className="flex flex-col items-center justify-center text-ink-600"><Home className="h-5 w-5" /><span className="text-[10px]">Home</span></Link><Link to="/categories" className="flex flex-col items-center justify-center text-ink-600"><Grid3x3 className="h-5 w-5" /><span className="text-[10px]">Categories</span></Link><Link to="/products" className="flex flex-col items-center justify-center text-ink-600"><Search className="h-5 w-5" /><span className="text-[10px]">Search</span></Link><Link to="/cart" className="flex flex-col items-center justify-center text-ink-600"><ShoppingCart className="h-5 w-5" /><span className="text-[10px]">Cart</span></Link><Link to="/account" className="flex flex-col items-center justify-center text-ink-600"><User className="h-5 w-5" /><span className="text-[10px]">Account</span></Link></div></nav><div className="h-14 lg:hidden" />
    </div>
  );
}
