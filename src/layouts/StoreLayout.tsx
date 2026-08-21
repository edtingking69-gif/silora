import { useState, useEffect, type ReactNode } from 'react';
import { Link, navigate, useRoute } from '@/components/router/Router';
import { ShoppingCart, User, Search, Menu, X, Heart, Package, Home, Grid3x3 } from 'lucide-react';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase';
import type { Category } from '@/types';
import { classNames } from '@/utils/format';

export function StoreLayout({ children }: { children: ReactNode }) {
  const { count } = useCart();
  const { user, profile } = useAuth();
  const route = useRoute();
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    supabase
      .from('categories')
      .select('*')
      .eq('is_active', true)
      .order('display_order')
      .then(({ data }) => setCategories((data as Category[]) ?? []));
  }, []);

  useEffect(() => {
    setMobileMenu(false);
  }, [route]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/products?q=${encodeURIComponent(searchQuery.trim())}`);
    }
  }

  const navLinks = [
    { label: 'Home', path: '/' },
    { label: 'All Products', path: '/products' },
    { label: 'Categories', path: '/categories' },
    ...categories.slice(0, 4).map((c) => ({ label: c.name, path: `/products?category=${c.slug}` })),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-ink-50">
      {/* Announcement bar */}
      <div className="bg-ink-900 text-center text-xs font-medium text-white py-2 px-4">
        Free shipping on all orders — No minimum order value!
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-ink-100 bg-white/90 backdrop-blur-lg">
        <div className="container-silora">
          <div className="flex h-16 items-center gap-3">
            <button
              className="lg:hidden rounded-lg p-2 text-ink-700 hover:bg-ink-100"
              onClick={() => setMobileMenu(true)}
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            <Link to="/" className="flex items-center gap-1.5 shrink-0">
              <span className="text-2xl font-extrabold tracking-tight text-ink-900">
                SIL<span className="text-primary-600">ORA</span>
              </span>
            </Link>

            {/* Search - desktop */}
            <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-xl mx-4">
              <div className="relative flex w-full">
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search products, categories..."
                  className="h-10 w-full rounded-l-xl border border-r-0 border-ink-300 bg-ink-50 px-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
                />
                <button
                  type="submit"
                  className="flex h-10 items-center rounded-r-xl bg-primary-600 px-4 text-white transition-colors hover:bg-primary-700"
                >
                  <Search className="h-4 w-4" />
                </button>
              </div>
            </form>

            <div className="ml-auto flex items-center gap-1">
              <Link
                to="/account"
                className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
              >
                <User className="h-5 w-5" />
                <span className="hidden sm:inline">{user ? (profile?.full_name?.split(' ')[0] || 'Account') : 'Login'}</span>
              </Link>
              <Link
                to="/cart"
                className="relative flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm font-medium text-ink-700 transition-colors hover:bg-ink-100"
              >
                <ShoppingCart className="h-5 w-5" />
                <span className="hidden sm:inline">Cart</span>
                {count > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-[10px] font-bold text-white">
                    {count}
                  </span>
                )}
              </Link>
            </div>
          </div>

          {/* Category nav - desktop */}
          <nav className="hidden lg:flex items-center gap-1 h-11 -mt-1">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className="rounded-lg px-3 py-1.5 text-sm font-medium text-ink-600 transition-colors hover:bg-ink-100 hover:text-ink-900"
                activeClass="text-primary-700 bg-primary-50"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* Search - mobile */}
        <form onSubmit={handleSearch} className="md:hidden border-t border-ink-100 px-4 py-2.5">
          <div className="relative flex w-full">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products..."
              className="h-10 w-full rounded-l-xl border border-r-0 border-ink-300 bg-ink-50 px-4 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500"
            />
            <button type="submit" className="flex h-10 items-center rounded-r-xl bg-primary-600 px-4 text-white">
              <Search className="h-4 w-4" />
            </button>
          </div>
        </form>
      </header>

      {/* Mobile menu drawer */}
      {mobileMenu && (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setMobileMenu(false)} />
          <div className="absolute left-0 top-0 h-full w-72 max-w-[85%] bg-white shadow-card-hover animate-slide-up p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-extrabold tracking-tight text-ink-900">
                SIL<span className="text-primary-600">ORA</span>
              </span>
              <button onClick={() => setMobileMenu(false)} className="rounded-lg p-2 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="flex flex-col gap-1">
              <Link to="/" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100" activeClass="bg-primary-50 text-primary-700">
                Home
              </Link>
              <Link to="/products" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100" activeClass="bg-primary-50 text-primary-700">
                All Products
              </Link>
              <Link to="/categories" className="rounded-xl px-3 py-2.5 text-sm font-semibold text-ink-800 hover:bg-ink-100" activeClass="bg-primary-50 text-primary-700">
                Categories
              </Link>
              <div className="my-2 border-t border-ink-100" />
              {categories.map((c) => (
                <Link
                  key={c.id}
                  to={`/products?category=${c.slug}`}
                  className="rounded-xl px-3 py-2.5 text-sm font-medium text-ink-600 hover:bg-ink-100"
                >
                  {c.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Main */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="border-t border-ink-200 bg-ink-900 text-ink-300">
        <div className="container-silora py-12">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4 lg:grid-cols-5">
            <div className="col-span-2">
              <span className="text-2xl font-extrabold text-white">
                SIL<span className="text-primary-500">ORA</span>
              </span>
              <p className="mt-3 max-w-xs text-sm text-ink-400">
                India's premium multi-category online store. Shop fashion, electronics, home, beauty and more at the best prices.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Shop</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/products" className="hover:text-white transition-colors">All Products</Link></li>
                <li><Link to="/categories" className="hover:text-white transition-colors">Categories</Link></li>
                <li><Link to="/cart" className="hover:text-white transition-colors">Cart</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Account</h4>
              <ul className="space-y-2 text-sm">
                <li><Link to="/account" className="hover:text-white transition-colors">My Account</Link></li>
                <li><Link to="/account/orders" className="hover:text-white transition-colors">My Orders</Link></li>
                <li><Link to="/login" className="hover:text-white transition-colors">Login</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-sm font-bold text-white mb-3">Help</h4>
              <ul className="space-y-2 text-sm">
                <li><a href="#/" className="hover:text-white transition-colors">Shipping Info</a></li>
                <li><a href="#/" className="hover:text-white transition-colors">Returns</a></li>
                <li><a href="#/" className="hover:text-white transition-colors">Contact Us</a></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 border-t border-ink-800 pt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-ink-500">© {new Date().getFullYear()} SILORA. All rights reserved.</p>
            <div className="flex items-center gap-3 text-xs text-ink-500">
              <span>Secure Payments</span>
              <span>•</span>
              <span>UPI / COD</span>
              <span>•</span>
              <span>Fast Delivery</span>
            </div>
          </div>
        </div>
      </footer>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-ink-200 bg-white/95 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 h-14">
          <Link to="/" className="flex flex-col items-center justify-center gap-0.5 text-ink-600" activeClass="text-primary-600">
            <Home className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Home</span>
          </Link>
          <Link to="/categories" className="flex flex-col items-center justify-center gap-0.5 text-ink-600" activeClass="text-primary-600">
            <Grid3x3 className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Categories</span>
          </Link>
          <Link to="/products" className="flex flex-col items-center justify-center gap-0.5 text-ink-600" activeClass="text-primary-600">
            <Search className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Search</span>
          </Link>
          <Link to="/cart" className="relative flex flex-col items-center justify-center gap-0.5 text-ink-600" activeClass="text-primary-600">
            <div className="relative">
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -right-2 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-600 px-1 text-[9px] font-bold text-white">
                  {count}
                </span>
              )}
            </div>
            <span className="text-[10px] font-semibold">Cart</span>
          </Link>
          <Link to="/account" className="flex flex-col items-center justify-center gap-0.5 text-ink-600" activeClass="text-primary-600">
            <User className="h-5 w-5" />
            <span className="text-[10px] font-semibold">Account</span>
          </Link>
        </div>
      </nav>
      <div className="h-14 lg:hidden" />
    </div>
  );
}
