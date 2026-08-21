import { useEffect, useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { fetchProduct, fetchProductVariants, fetchRelatedProducts, fetchReviews } from '@/services/api';
import type { Product, ProductVariant, Review } from '@/types';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Stars } from '@/components/ui/Stars';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState } from '@/components/ui/EmptyState';
import { ProductCard } from '@/components/ProductCard';
import { useCart } from '@/contexts/CartContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, discountPercent, classNames } from '@/utils/format';
import { ShoppingCart, Zap, Truck, RotateCcw, ShieldCheck, Check, Minus, Plus, ChevronRight } from 'lucide-react';

export function ProductDetailPage({ id }: { id: string }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [related, setRelated] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [quantity, setQuantity] = useState(1);

  const { addToCart } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    async function load() {
      setLoading(true);
      setNotFound(false);
      const p = await fetchProduct(id);
      if (!p) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      setProduct(p);
      const [v, r, rev] = await Promise.all([
        fetchProductVariants(id),
        fetchRelatedProducts(id, p.category_id, 6),
        fetchReviews(id),
      ]);
      setVariants(v as ProductVariant[]);
      setRelated(r);
      setReviews(rev);
      setSelectedImage(0);
      setSelectedVariant(null);
      setQuantity(1);
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) return <ProductDetailSkeleton />;
  if (notFound || !product)
    return (
      <EmptyState
        icon={<ShoppingCart className="h-8 w-8" />}
        title="Product not found"
        message="The product you're looking for doesn't exist or has been removed."
        action={<Link to="/products" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">Browse Products</Link>}
      />
    );

  const images = product.product_images ?? [];
  const discount = discountPercent(Number(product.price), product.original_price ? Number(product.original_price) : null);
  const effectivePrice = selectedVariant?.price_override ? Number(selectedVariant.price_override) : Number(product.price);
  const effectiveStock = selectedVariant ? selectedVariant.stock : product.stock;
  const outOfStock = effectiveStock <= 0;

  async function handleAddCart() {
    if (!user) {
      toast('Please sign in to add items to cart', 'info');
      navigate('/login');
      return;
    }
    if (outOfStock) return;
    await addToCart(product!, selectedVariant, quantity);
    toast('Added to cart');
  }

  async function handleBuyNow() {
    if (!user) {
      toast('Please sign in to continue', 'info');
      navigate('/login');
      return;
    }
    if (outOfStock) return;
    await addToCart(product!, selectedVariant, quantity);
    navigate('/checkout');
  }

  return (
    <div className="container-silora py-4 sm:py-6">
      {/* Breadcrumb */}
      <nav className="mb-4 flex items-center gap-1 text-xs text-ink-500">
        <Link to="/" className="hover:text-ink-800">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link to="/products" className="hover:text-ink-800">Products</Link>
        {product.category && (
          <>
            <ChevronRight className="h-3 w-3" />
            <Link to={`/products?category=${product.category.slug}`} className="hover:text-ink-800">{product.category.name}</Link>
          </>
        )}
        <ChevronRight className="h-3 w-3" />
        <span className="text-ink-800 font-medium truncate">{product.name}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        {/* Images */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-2xl border border-ink-100 bg-white">
            {images[selectedImage] ? (
              <img src={images[selectedImage].url} alt={product.name} className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-ink-100 text-ink-300">
                <ShoppingCart className="h-16 w-16" />
              </div>
            )}
            {discount > 0 && (
              <div className="absolute left-3 top-3">
                <Badge variant="error">-{discount}% OFF</Badge>
              </div>
            )}
          </div>
          {images.length > 1 && (
            <div className="mt-3 flex gap-2 overflow-x-auto no-scrollbar">
              {images.map((img, i) => (
                <button
                  key={img.id}
                  onClick={() => setSelectedImage(i)}
                  className={classNames(
                    'h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 transition-colors',
                    selectedImage === i ? 'border-primary-500' : 'border-ink-200',
                  )}
                >
                  <img src={img.url} alt={img.alt ?? ''} className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Info */}
        <div>
          {product.category && (
            <Link to={`/products?category=${product.category.slug}`} className="text-sm font-semibold text-primary-600">
              {product.category.name}
            </Link>
          )}
          <h1 className="mt-1 text-2xl font-bold text-ink-900 sm:text-3xl text-balance">{product.name}</h1>

          <div className="mt-3 flex items-center gap-3">
            <Stars rating={product.rating} size={18} />
            <span className="text-sm text-ink-500">
              {product.rating > 0 ? `${product.rating} (${product.review_count} reviews)` : 'No reviews yet'}
            </span>
          </div>

          <div className="mt-5 flex items-end gap-3">
            <span className="text-3xl font-extrabold text-ink-900">{formatINR(effectivePrice)}</span>
            {product.original_price && Number(product.original_price) > effectivePrice && (
              <span className="text-lg text-ink-400 line-through">{formatINR(product.original_price)}</span>
            )}
            {discount > 0 && (
              <span className="text-sm font-bold text-error-600">You save {formatINR(Number(product.original_price) - effectivePrice)}</span>
            )}
          </div>

          {/* Stock status */}
          <div className="mt-3">
            {outOfStock ? (
              <Badge variant="error">Out of Stock</Badge>
            ) : effectiveStock <= 5 ? (
              <Badge variant="warning">Only {effectiveStock} left in stock!</Badge>
            ) : (
              <Badge variant="success"><Check className="mr-1 inline h-3 w-3" />In Stock</Badge>
            )}
          </div>

          <p className="mt-5 text-sm text-ink-600 leading-relaxed whitespace-pre-line">
            {product.description || 'No description available.'}
          </p>

          {/* Variants */}
          {variants.length > 0 && (
            <div className="mt-5">
              <h3 className="text-sm font-bold text-ink-900 mb-2">Options</h3>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => (
                  <button
                    key={v.id}
                    onClick={() => setSelectedVariant(v)}
                    className={classNames(
                      'rounded-xl border px-4 py-2 text-sm font-medium transition-colors',
                      selectedVariant?.id === v.id
                        ? 'border-primary-500 bg-primary-50 text-primary-700'
                        : 'border-ink-300 bg-white text-ink-700 hover:border-ink-400',
                    )}
                  >
                    {v.name}: {v.value}
                    {v.price_override && ` (+${formatINR(v.price_override)})`}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Quantity + actions */}
          {!outOfStock && (
            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex items-center rounded-xl border border-ink-300">
                <button
                  onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                  className="flex h-11 w-11 items-center justify-center text-ink-600 hover:bg-ink-100 rounded-l-xl"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="w-12 text-center text-sm font-bold">{quantity}</span>
                <button
                  onClick={() => setQuantity((q) => Math.min(effectiveStock, q + 1))}
                  className="flex h-11 w-11 items-center justify-center text-ink-600 hover:bg-ink-100 rounded-r-xl"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <Button onClick={handleAddCart} variant="outline" className="flex-1" size="lg">
                <ShoppingCart className="h-4 w-4" /> Add to Cart
              </Button>
              <Button onClick={handleBuyNow} className="flex-1" size="lg" disabled={outOfStock}>
                <Zap className="h-4 w-4" /> Buy Now
              </Button>
            </div>
          )}

          {/* Delivery info */}
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {[
              { icon: Truck, title: 'Free Delivery', desc: 'On all orders' },
              { icon: RotateCcw, title: '7-Day Returns', desc: 'Easy return policy' },
              { icon: ShieldCheck, title: 'Secure Payment', desc: 'Verified UPI & QR' },
            ].map((item) => (
              <div key={item.title} className="flex items-center gap-2.5 rounded-xl border border-ink-100 bg-white p-3">
                <item.icon className="h-5 w-5 text-primary-600 shrink-0" />
                <div>
                  <p className="text-xs font-bold text-ink-900">{item.title}</p>
                  <p className="text-xs text-ink-500">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>

          {product.sku && (
            <p className="mt-4 text-xs text-ink-400">SKU: {product.sku}</p>
          )}
        </div>
      </div>

      {/* Reviews */}
      {reviews.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-ink-900 mb-4">Customer Reviews</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {reviews.map((rev) => (
              <div key={rev.id} className="rounded-2xl border border-ink-100 bg-white p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                      {(rev.author_name ?? 'A').charAt(0)}
                    </div>
                    <span className="text-sm font-semibold text-ink-900">{rev.author_name ?? 'Anonymous'}</span>
                  </div>
                  <Stars rating={rev.rating} size={12} />
                </div>
                {rev.title && <h4 className="mt-2 text-sm font-bold text-ink-900">{rev.title}</h4>}
                {rev.body && <p className="mt-1 text-sm text-ink-600">{rev.body}</p>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Related products */}
      {related.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold text-ink-900 mb-4">You Might Also Like</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 lg:grid-cols-6">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ProductDetailSkeleton() {
  return (
    <div className="container-silora py-6">
      <div className="grid gap-6 lg:grid-cols-2 lg:gap-10">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="flex flex-col gap-4">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-10 w-40" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );
}