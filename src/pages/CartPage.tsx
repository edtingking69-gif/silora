import { Link, navigate } from '@/components/router/Router';
import { useCart } from '@/contexts/CartContext';
import { formatINR } from '@/utils/format';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/EmptyState';
import { Minus, Plus, Trash2, ShoppingCart, ArrowLeft, Truck } from 'lucide-react';
import { useState, useEffect } from 'react';
import { fetchShippingConfig } from '@/services/api';
import type { ShippingConfig } from '@/types';

export function CartPage() {
  const { items, loading, updateQuantity, removeItem } = useCart();
  const [shippingConfig, setShippingConfig] = useState<ShippingConfig | null>(null);

  useEffect(() => {
    fetchShippingConfig().then(setShippingConfig);
  }, []);

  const subtotal = items.reduce((sum, i) => {
    const price = i.variant?.price_override ? Number(i.variant.price_override) : Number(i.product?.price ?? 0);
    return sum + price * i.quantity;
  }, 0);

  const shippingFee = shippingConfig?.shipping_fee ?? 0;
  const freeThreshold = shippingConfig?.free_shipping_threshold ?? 0;
  const freeEnabled = shippingConfig?.enabled ?? true;
  const shipping = freeEnabled && (freeThreshold === 0 || subtotal >= freeThreshold) ? 0 : shippingFee;
  const total = subtotal + shipping;

  if (loading) {
    return (
      <div className="container-silora py-6">
        <div className="h-8 w-32 rounded-lg bg-ink-200 animate-shimmer" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-2xl bg-ink-100 animate-shimmer" />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="container-silora py-6">
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8" />}
          title="Your cart is empty"
          message="Browse our products and add items to your cart to get started."
          action={<Link to="/products" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">Start Shopping</Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-silora py-6">
      <h1 className="text-xl font-bold text-ink-900 sm:text-2xl mb-5">Shopping Cart ({items.length})</h1>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Items */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item) => {
            const price = item.variant?.price_override ? Number(item.variant.price_override) : Number(item.product?.price ?? 0);
            return (
              <div key={item.id} className="flex gap-3 rounded-2xl border border-ink-100 bg-white p-3">
                <Link to={`/product/${item.product_id}`} className="shrink-0">
                  <div className="h-24 w-24 overflow-hidden rounded-xl bg-ink-100">
                    {item.product?.product_images?.[0]?.url ? (
                      <img src={item.product.product_images[0].url} alt={item.product.name} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-ink-300">
                        <ShoppingCart className="h-8 w-8" />
                      </div>
                    )}
                  </div>
                </Link>

                <div className="flex flex-1 flex-col">
                  <Link to={`/product/${item.product_id}`} className="text-sm font-semibold text-ink-900 line-clamp-2 hover:text-primary-600">
                    {item.product?.name}
                  </Link>
                  {item.variant && (
                    <p className="text-xs text-ink-500 mt-0.5">{item.variant.name}: {item.variant.value}</p>
                  )}
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-base font-bold text-ink-900">{formatINR(price)}</span>
                    {item.product?.original_price && Number(item.product.original_price) > price && (
                      <span className="text-xs text-ink-400 line-through">{formatINR(item.product.original_price)}</span>
                    )}
                  </div>

                  <div className="mt-auto flex items-center justify-between pt-2">
                    <div className="flex items-center rounded-lg border border-ink-300">
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity - 1)}
                        className="flex h-8 w-8 items-center justify-center text-ink-600 hover:bg-ink-100 rounded-l-lg"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="w-10 text-center text-sm font-bold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="flex h-8 w-8 items-center justify-center text-ink-600 hover:bg-ink-100 rounded-r-lg"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <button
                      onClick={() => removeItem(item.id)}
                      className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-error-600 hover:bg-error-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Remove
                    </button>
                  </div>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-ink-900">{formatINR(price * item.quantity)}</p>
                </div>
              </div>
            );
          })}

          <Link to="/products" className="inline-flex items-center gap-2 text-sm font-semibold text-primary-600 hover:text-primary-700 pt-2">
            <ArrowLeft className="h-4 w-4" /> Continue Shopping
          </Link>
        </div>

        {/* Summary */}
        <div className="lg:col-span-1">
          <div className="sticky top-32 rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-base font-bold text-ink-900 mb-4">Order Summary</h2>

            {shipping === 0 && (
              <div className="mb-4 rounded-xl bg-success-50 p-3 text-xs text-success-700">
                <Truck className="mr-1.5 inline h-3.5 w-3.5" />
                Free shipping on all orders!
              </div>
            )}

            <div className="space-y-2.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-600">Subtotal</span>
                <span className="font-semibold text-ink-900">{formatINR(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-600">Shipping</span>
                <span className="font-semibold text-ink-900">
                  {shipping === 0 ? <span className="text-success-600">FREE</span> : formatINR(shipping)}
                </span>
              </div>
              <div className="border-t border-ink-100 pt-2.5 flex justify-between">
                <span className="font-bold text-ink-900">Total</span>
                <span className="text-lg font-extrabold text-primary-600">{formatINR(total)}</span>
              </div>
            </div>

            <Button onClick={() => navigate('/checkout')} className="mt-5 w-full" size="lg">
              Proceed to Checkout
            </Button>
            <p className="mt-3 text-center text-xs text-ink-400">Secure checkout · UPI & COD available</p>
          </div>
        </div>
      </div>
    </div>
  );
}
