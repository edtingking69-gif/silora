import { useEffect, useState, useCallback } from 'react';
import { fetchProducts, fetchCategories } from '@/services/api';
import type { Product, Category } from '@/types';
import { ProductCard } from '@/components/ProductCard';
import { GridSkeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input, Select } from '@/components/ui/Input';
import { SlidersHorizontal, Search, X, Package } from 'lucide-react';
import { classNames } from '@/utils/format';

function parseQuery(): { q?: string; category?: string } {
  const hash = window.location.hash.slice(1);
  const queryIdx = hash.indexOf('?');
  if (queryIdx === -1) return {};
  const params = new URLSearchParams(hash.slice(queryIdx + 1));
  return { q: params.get('q') ?? undefined, category: params.get('category') ?? undefined };
}

export function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showFilters, setShowFilters] = useState(false);

  const initial = parseQuery();
  const [search, setSearch] = useState(initial.q ?? '');
  const [category, setCategory] = useState(initial.category ?? '');
  const [sort, setSort] = useState('newest');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [inStock, setInStock] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { products, total } = await fetchProducts({
      category: category || undefined,
      search: search || undefined,
      sort,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      inStock,
      page,
      limit: 12,
    });
    setProducts(products);
    setTotal(total);
    setTotalPages(Math.max(1, Math.ceil(total / 12)));
    setLoading(false);
  }, [category, search, sort, minPrice, maxPrice, inStock, page]);

  useEffect(() => {
    fetchCategories().then(setCategories);
  }, []);

  useEffect(() => {
    const i = parseQuery();
    setSearch(i.q ?? '');
    setCategory(i.category ?? '');
    setPage(1);
  }, [window.location.hash]);

  useEffect(() => {
    load();
  }, [load]);

  function applyFilters() {
    setPage(1);
    setShowFilters(false);
    load();
  }

  function clearFilters() {
    setSearch('');
    setCategory('');
    setMinPrice('');
    setMaxPrice('');
    setInStock(false);
    setSort('newest');
    setPage(1);
  }

  const activeFilters = [category, minPrice, maxPrice, inStock ? 'in-stock' : ''].filter(Boolean).length;

  return (
    <div className="container-silora py-6">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">
            {category ? categories.find((c) => c.slug === category)?.name ?? 'Products' : 'All Products'}
          </h1>
          <p className="text-sm text-ink-500 mt-0.5">{total} products found</p>
        </div>
        <button
          onClick={() => setShowFilters(true)}
          className="flex items-center gap-2 rounded-xl border border-ink-300 bg-white px-3 py-2 text-sm font-semibold text-ink-800 lg:hidden"
        >
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {activeFilters > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary-600 px-1 text-xs font-bold text-white">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      <div className="flex gap-6">
        {/* Desktop filters */}
        <aside className="hidden lg:block w-64 shrink-0">
          <div className="sticky top-32 rounded-2xl border border-ink-100 bg-white p-5">
            <FilterContent
              search={search} setSearch={setSearch}
              category={category} setCategory={setCategory}
              categories={categories}
              minPrice={minPrice} setMinPrice={setMinPrice}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice}
              inStock={inStock} setInStock={setInStock}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          </div>
        </aside>

        <div className="flex-1">
          {/* Sort bar */}
          <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-ink-100 bg-white p-3">
            <span className="text-sm font-medium text-ink-600 hidden sm:inline">Sort by:</span>
            <select
              value={sort}
              onChange={(e) => { setSort(e.target.value); setPage(1); }}
              className="h-9 rounded-lg border border-ink-300 bg-white px-3 text-sm font-medium text-ink-800 focus:outline-none focus:ring-2 focus:ring-primary-500/30"
            >
              <option value="newest">Newest First</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="rating">Top Rated</option>
              <option value="popular">Most Popular</option>
            </select>
          </div>

          {loading ? (
            <GridSkeleton count={12} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No products found"
              message="Try adjusting your filters or search terms to find what you're looking for."
              action={
                <button onClick={clearFilters} className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary-700">
                  Clear Filters
                </button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-4">
                {products.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                    className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 disabled:opacity-40 hover:bg-ink-50"
                  >
                    Previous
                  </button>
                  <span className="px-4 text-sm font-medium text-ink-600">
                    Page {page} of {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-ink-300 px-4 py-2 text-sm font-semibold text-ink-700 disabled:opacity-40 hover:bg-ink-50"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Mobile filter sheet */}
      {showFilters && (
        <div className="fixed inset-0 z-[100] lg:hidden">
          <div className="absolute inset-0 bg-ink-950/50 animate-fade-in" onClick={() => setShowFilters(false)} />
          <div className="absolute bottom-0 left-0 right-0 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-5 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-bold text-ink-900">Filters</h2>
              <button onClick={() => setShowFilters(false)} className="rounded-lg p-2 hover:bg-ink-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <FilterContent
              search={search} setSearch={setSearch}
              category={category} setCategory={setCategory}
              categories={categories}
              minPrice={minPrice} setMinPrice={setMinPrice}
              maxPrice={maxPrice} setMaxPrice={setMaxPrice}
              inStock={inStock} setInStock={setInStock}
              onApply={applyFilters}
              onClear={clearFilters}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FilterContent({
  search, setSearch, category, setCategory, categories,
  minPrice, setMinPrice, maxPrice, setMaxPrice,
  inStock, setInStock, onApply, onClear,
}: {
  search: string; setSearch: (v: string) => void;
  category: string; setCategory: (v: string) => void;
  categories: Category[];
  minPrice: string; setMinPrice: (v: string) => void;
  maxPrice: string; setMaxPrice: (v: string) => void;
  inStock: boolean; setInStock: (v: boolean) => void;
  onApply: () => void; onClear: () => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onApply()}
          placeholder="Search..."
          className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink-900">Category</h3>
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setCategory('')}
            className={classNames(
              'rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
              !category ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-100',
            )}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategory(c.slug)}
              className={classNames(
                'rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                category === c.slug ? 'bg-primary-50 text-primary-700' : 'text-ink-600 hover:bg-ink-100',
              )}
            >
              {c.name}
            </button>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink-900">Price Range</h3>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={minPrice}
            onChange={(e) => setMinPrice(e.target.value)}
            placeholder="Min"
            className="h-10 w-full rounded-xl border border-ink-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
          <span className="text-ink-400">—</span>
          <input
            type="number"
            value={maxPrice}
            onChange={(e) => setMaxPrice(e.target.value)}
            placeholder="Max"
            className="h-10 w-full rounded-xl border border-ink-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-ink-900">Availability</h3>
        <label className="flex items-center gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={inStock}
            onChange={(e) => setInStock(e.target.checked)}
            className="h-4 w-4 rounded border-ink-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-ink-700">In stock only</span>
        </label>
      </div>

      <div className="flex gap-2 pt-2">
        <button
          onClick={onClear}
          className="flex-1 rounded-xl border border-ink-300 py-2.5 text-sm font-semibold text-ink-700 hover:bg-ink-50"
        >
          Clear All
        </button>
        <button
          onClick={onApply}
          className="flex-1 rounded-xl bg-primary-600 py-2.5 text-sm font-semibold text-white hover:bg-primary-700"
        >
          Apply
        </button>
      </div>
    </div>
  );
}
