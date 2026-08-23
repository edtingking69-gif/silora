import { useEffect, useState } from 'react';
import { Link } from '@/components/router/Router';
import { supabase } from '@/lib/supabase';
import { fetchProductsByFlag, fetchCategories } from '@/services/api';
import type { Product, Category } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { GridSkeleton, Skeleton } from '@/components/ui/Skeleton';
import { Truck, ShieldCheck, RotateCcw, Headphones, ArrowRight, Star } from 'lucide-react';
import { formatINR, discountPercent } from '@/utils/format';

export function HomePage() {
  const [featured, setFeatured] = useState<Product[]>([]);
  const [trending, setTrending] = useState<Product[]>([]);
  const [newArrivals, setNewArrivals] = useState<Product[]>([]);
  const [bestsellers, setBestsellers] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [specialOffer, setSpecialOffer] = useState<Product | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [f, t, n, b, c] = await Promise.all([
          fetchProductsByFlag('is_featured', 10),
          fetchProductsByFlag('is_trending', 10),
          fetchProductsByFlag('is_new', 10),
          fetchProductsByFlag('is_bestseller', 10),
          fetchCategories(),
        ]);
        setFeatured(f);
        setTrending(t);
        setNewArrivals(n);
        setBestsellers(b);
        setCategories(c);
        const all = [...f, ...b, ...t];
        const offer = all
          .filter((p) => p.original_price && discountPercent(Number(p.price), Number(p.original_price)) >= 20)
          .sort((a, b) => discountPercent(Number(b.price), b.original_price ? Number(b.original_price) : null) - discountPercent(Number(a.price), a.original_price ? Number(a.original_price) : null))[0];
        setSpecialOffer(offer ?? null);
      } catch (error) {
        console.error('SILORA home data loading failed', error);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-ink-900 via-ink-800 to-ink-900">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute -right-20 -top-20 h-96 w-96 rounded-full bg-primary-500 blur-3xl" />
          <div className="absolute -bottom-20 -left-20 h-96 w-96 rounded-full bg-accent-500 blur-3xl" />
        </div>
        <div className="container-silora relative">
          <div className="grid items-center gap-8 py-12 md:py-20 lg:grid-cols-2">
            <div className="text-center lg:text-left">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-500/10 px-3 py-1 text-xs font-semibold text-primary-400 ring-1 ring-primary-500/20">
                <Star className="h-3 w-3 fill-primary-400" /> India's Premium Store
              </span>
              <h1 className="mt-4 text-4xl font-extrabold leading-tight text-white sm:text-5xl lg:text-6xl text-balance">
                Shop Smarter,<br />
                <span className="bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
                  Live Better
                </span>
              </h1>
              <p className="mt-4 text-base text-ink-300 sm:text-lg max-w-md mx-auto lg:mx-0">
                Discover premium products across fashion, electronics, home, beauty and more. Delivered fast, priced right.
              </p>
              <div className="mt-8 flex flex-wrap justify-center gap-3 lg:justify-start">
                <Link
                  to="/products"
                  className="inline-flex h-12 items-center gap-2 rounded-xl bg-primary-600 px-6 text-sm font-bold text-white transition-all hover:bg-primary-700 hover:shadow-glow active:scale-95"
                >
                  Shop Now <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/categories"
                  className="inline-flex h-12 items-center rounded-xl border border-ink-700 px-6 text-sm font-bold text-white transition-colors hover:bg-ink-800"
                >
                  Browse Categories
                </Link>
              </div>
            </div>
            {specialOffer && (
              <div className="hidden lg:block">
                <Link
                  to={`/product/${specialOffer.id}`}
                  className="group block overflow-hidden rounded-3xl bg-white/5 p-6 ring-1 ring-white/10 backdrop-blur transition-all hover:bg-white/10"
                >
                  <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-ink-800">
                    {specialOffer.product_images?.[0]?.url && (
                      <img
                        src={specialOffer.product_images[0].url}
                        alt={specialOffer.name}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    )}
                    <div className="absolute right-3 top-3 rounded-full bg-error-500 px-3 py-1 text-xs font-bold text-white">
                      -{discountPercent(Number(specialOffer.price), specialOffer.original_price ? Number(specialOffer.original_price) : null)}%
                    </div>
                  </div>
                  <div className="mt-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary-400">Special Offer</p>
                    <h3 className="mt-1 text-lg font-bold text-white">{specialOffer.name}</h3>
                    <div className="mt-2 flex items-center gap-2">
                      <span className="text-2xl font-extrabold text-white">{formatINR(specialOffer.price)}</span>
                      {specialOffer.original_price && (
                        <span className="text-sm text-ink-400 line-through">{formatINR(specialOffer.original_price)}</span>
                      )}
                    </div>
                  </div>
                </Link>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Trust badges */}
      <section className="border-b border-ink-100 bg-white">
        <div className="container-silora grid grid-cols-2 gap-4 py-6 md:grid-cols-4 md:gap-8">
          {[
            { icon: Truck, title: 'Fast Delivery', desc: 'Across India' },
            { icon: ShieldCheck, title: 'Secure Payments', desc: '100% Verified UPI' },
            { icon: RotateCcw, title: 'Easy Returns', desc: '7-day return' },
            { icon: Headphones, title: '24/7 Support', desc: 'Always here' },
          ].map((item) => (
            <div key={item.title} className="flex items-center gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                <item.icon className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-bold text-ink-900">{item.title}</p>
                <p className="text-xs text-ink-500">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Category cards */}
      <section className="container-silora py-10">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">Shop by Category</h2>
          <Link to="/categories" className="text-sm font-semibold text-primary-600 hover:text-primary-700">
            View all →
          </Link>
        </div>
        {loading ? (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
            {categories.map((cat) => (
              <Link
                key={cat.id}
                to={`/products?category=${cat.slug}`}
                className="group relative flex aspect-square flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border border-ink-100 bg-white p-3 text-center transition-all hover:shadow-card-hover hover:-translate-y-0.5"
              >
                {cat.image_url ? (
                  <div className="absolute inset-0 opacity-10 transition-opacity group-hover:opacity-20">
                    <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
                  </div>
                ) : (
                  <div className="absolute inset-0 bg-gradient-to-br from-primary-50 to-accent-50 opacity-50" />
                )}
                <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-lg font-bold text-primary-700">
                  {cat.name.charAt(0).toUpperCase()}
                </div>
                <span className="relative text-xs font-semibold text-ink-800 leading-tight">{cat.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Featured products */}
      <ProductSection title="Featured Products" products={featured} loading={loading} viewAll="/products" />

      {/* Special offer banner */}
      <section className="container-silora py-6">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-primary-600 to-primary-500 p-8 text-center sm:p-12">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-white/10" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-wide text-primary-100">Limited Time</p>
            <h2 className="mt-2 text-2xl font-extrabold text-white sm:text-3xl">Mega Sale — Up to 70% Off</h2>
            <p className="mt-2 text-primary-100">Grab the best deals before they're gone</p>
            <Link
              to="/products"
              className="mt-6 inline-flex h-11 items-center rounded-xl bg-white px-6 text-sm font-bold text-primary-700 transition-transform hover:scale-105 active:scale-95"
            >
              Shop Deals <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      {/* Trending */}
      <ProductSection title="Trending Now" products={trending} loading={loading} viewAll="/products" />

      {/* New arrivals */}
      <ProductSection title="New Arrivals" products={newArrivals} loading={loading} viewAll="/products" />

      {/* Best sellers */}
      <ProductSection title="Best Sellers" products={bestsellers} loading={loading} viewAll="/products" />

      {/* Why shop with SILORA */}
      <section className="bg-white border-y border-ink-100 py-12">
        <div className="container-silora">
          <h2 className="text-center text-xl font-bold text-ink-900 sm:text-2xl mb-8">Why Shop with SILORA?</h2>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: ShieldCheck, title: '100% Authentic', desc: 'Genuine products, quality guaranteed on every order.' },
              { icon: Truck, title: 'Pan-India Delivery', desc: 'Fast and reliable shipping to every corner of India.' },
              { icon: RotateCcw, title: 'Hassle-Free Returns', desc: 'Changed your mind? Return within 7 days, no questions.' },
              { icon: Headphones, title: 'Dedicated Support', desc: 'Our team is here to help you before and after your purchase.' },
            ].map((item) => (
              <div key={item.title} className="text-center">
                <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary-600">
                  <item.icon className="h-6 w-6" />
                </div>
                <h3 className="font-bold text-ink-900">{item.title}</h3>
                <p className="mt-1.5 text-sm text-ink-500">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Customer reviews */}
      <section className="container-silora py-12">
        <h2 className="text-center text-xl font-bold text-ink-900 sm:text-2xl mb-8">What Our Customers Say</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            { name: 'Priya S.', city: 'Mumbai', text: 'Amazing quality and super fast delivery! SILORA is my go-to for online shopping now.', rating: 5 },
            { name: 'Rahul K.', city: 'Bengaluru', text: 'Great prices and genuine products. The UPI payment made checkout so easy.', rating: 5 },
            { name: 'Anita R.', city: 'Delhi', text: 'Love the variety of products. The return process was quick and hassle-free.', rating: 4 },
          ].map((rev) => (
            <div key={rev.name} className="rounded-2xl border border-ink-100 bg-white p-5 shadow-card">
              <div className="flex items-center gap-1 mb-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className={`h-4 w-4 ${i < rev.rating ? 'fill-warning-500 text-warning-500' : 'fill-ink-200 text-ink-200'}`} />
                ))}
              </div>
              <p className="text-sm text-ink-700 leading-relaxed">"{rev.text}"</p>
              <div className="mt-4 flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                  {rev.name.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-semibold text-ink-900">{rev.name}</p>
                  <p className="text-xs text-ink-500">{rev.city}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductSection({ title, products, loading, viewAll }: { title: string; products: Product[]; loading: boolean; viewAll: string }) {
  if (loading) {
    return (
      <section className="container-silora py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
        </div>
        <div className="flex gap-3 overflow-hidden">
          <GridSkeleton count={5} />
        </div>
      </section>
    );
  }
  if (products.length === 0) return null;
  return (
    <section className="container-silora py-6">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-xl font-bold text-ink-900 sm:text-2xl">{title}</h2>
        <Link to={viewAll} className="text-sm font-semibold text-primary-600 hover:text-primary-700">
          View all →
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2 md:grid md:grid-cols-5 md:overflow-visible md:gap-4 md:pb-0">
        {products.map((p) => (
          <div key={p.id} className="w-44 shrink-0 md:w-auto">
            <ProductCard product={p} />
          </div>
        ))}
      </div>
    </section>
  );
}