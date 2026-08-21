import { useEffect, useState } from 'react';
import { Link } from '@/components/router/Router';
import { fetchCategories } from '@/services/api';
import type { Category } from '@/types';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { Grid3x3 } from 'lucide-react';

export function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCategories().then((c) => {
      setCategories(c);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <div className="container-silora py-6">
        <h1 className="text-xl font-bold text-ink-900 sm:text-2xl mb-5">All Categories</h1>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3] rounded-2xl" />)}
        </div>
      </div>
    );
  }

  if (categories.length === 0)
    return (
      <div className="container-silora py-6">
        <EmptyState icon={<Grid3x3 className="h-8 w-8" />} title="No categories yet" message="Categories will appear here once added." />
      </div>
    );

  return (
    <div className="container-silora py-6">
      <h1 className="text-xl font-bold text-ink-900 sm:text-2xl mb-5">All Categories</h1>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {categories.map((cat) => (
          <Link
            key={cat.id}
            to={`/products?category=${cat.slug}`}
            className="group relative flex aspect-[4/3] flex-col items-center justify-center gap-3 overflow-hidden rounded-2xl border border-ink-100 bg-white p-6 text-center transition-all hover:shadow-card-hover hover:-translate-y-0.5"
          >
            {cat.image_url ? (
              <div className="absolute inset-0 opacity-15 transition-opacity group-hover:opacity-25">
                <img src={cat.image_url} alt={cat.name} className="h-full w-full object-cover" />
              </div>
            ) : (
              <div className="absolute inset-0 bg-gradient-to-br from-primary-50 via-white to-accent-50" />
            )}
            <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-primary-600 text-2xl font-extrabold text-white shadow-sm">
              {cat.name.charAt(0).toUpperCase()}
            </div>
            <div className="relative">
              <h3 className="font-bold text-ink-900">{cat.name}</h3>
              {cat.description && <p className="mt-1 text-xs text-ink-500 line-clamp-2">{cat.description}</p>}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
