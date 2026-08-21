import { Link } from '@/components/router/Router';
import { ShoppingCart, Heart } from 'lucide-react';
import type { Product } from '@/types';
import { formatINR, discountPercent, classNames } from '@/utils/format';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Badge } from '@/components/ui/Badge';

export function ProductCard({ product }: { product: Product }) {
  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  const image = product.product_images?.[0]?.url;
  const discount = discountPercent(Number(product.price), product.original_price ? Number(product.original_price) : null);
  const outOfStock = product.stock <= 0;

  async function handleAdd(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!user) {
      toast('Please sign in to add items to cart', 'info');
      return;
    }
    if (outOfStock) return;
    await addToCart(product, null, 1);
    toast('Added to cart');
  }

  return (
    <Link
      to={`/product/${product.id}`}
      className="group relative flex flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-0.5"
    >
      <div className="relative aspect-square overflow-hidden bg-ink-100">
        {image ? (
          <img
            src={image}
            alt={product.name}
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-ink-100 text-ink-300">
            <ShoppingCart className="h-10 w-10" />
          </div>
        )}
        <div className="absolute left-2 top-2 flex flex-col gap-1">
          {discount > 0 && <Badge variant="error">-{discount}%</Badge>}
          {product.is_new && <Badge variant="info">New</Badge>}
          {product.is_bestseller && <Badge variant="primary">Bestseller</Badge>}
        </div>
        <button
          className="absolute right-2 top-2 rounded-lg bg-white/80 p-1.5 text-ink-400 backdrop-blur transition-colors hover:text-error-500"
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); }}
          aria-label="Wishlist"
        >
          <Heart className="h-4 w-4" />
        </button>
        {outOfStock && (
          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
            <span className="rounded-full bg-ink-900/80 px-4 py-1.5 text-xs font-bold uppercase tracking-wide text-white">
              Out of Stock
            </span>
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <h3 className="line-clamp-2 text-sm font-semibold text-ink-900 leading-snug">{product.name}</h3>
        {product.category && (
          <p className="text-xs text-ink-500">{product.category.name}</p>
        )}
        <div className="mt-auto flex items-end gap-2 pt-1">
          <span className="text-base font-bold text-ink-900">{formatINR(product.price)}</span>
          {product.original_price && Number(product.original_price) > Number(product.price) && (
            <span className="text-xs text-ink-400 line-through">{formatINR(product.original_price)}</span>
          )}
        </div>
        <button
          onClick={handleAdd}
          disabled={outOfStock}
          className={classNames(
            'mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg text-xs font-semibold transition-colors',
            outOfStock
              ? 'cursor-not-allowed bg-ink-100 text-ink-400'
              : 'bg-primary-50 text-primary-700 hover:bg-primary-600 hover:text-white',
          )}
        >
          <ShoppingCart className="h-3.5 w-3.5" />
          {outOfStock ? 'Out of Stock' : 'Add to Cart'}
        </button>
      </div>
    </Link>
  );
}
