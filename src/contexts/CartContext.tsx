import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import type { CartItem, Product, ProductVariant } from '@/types';

interface CartContextValue {
  items: CartItem[];
  loading: boolean;
  count: number;
  addToCart: (product: Product, variant?: ProductVariant | null, quantity?: number) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeItem: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refresh: () => Promise<void>;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await supabase
        .from('cart_items')
        .select(`
          *,
          product:products(*),
          variant:product_variants(*)
        `)
        .eq('user_id', user.id);
      setItems((data as CartItem[]) ?? []);
    } catch (error) {
      console.error('SILORA cart initialization failed', error);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const addToCart = useCallback(
    async (product: Product, variant?: ProductVariant | null, quantity = 1) => {
      if (!user) return;
      // Check existing
      const existing = items.find(
        (i) => i.product_id === product.id && i.variant_id === (variant?.id ?? null),
      );
      if (existing) {
        await supabase
          .from('cart_items')
          .update({ quantity: existing.quantity + quantity })
          .eq('id', existing.id);
      } else {
        await supabase.from('cart_items').insert({
          user_id: user.id,
          product_id: product.id,
          variant_id: variant?.id ?? null,
          quantity,
        });
      }
      await refresh();
    },
    [user, items, refresh],
  );

  const updateQuantity = useCallback(
    async (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        await removeItem(itemId);
        return;
      }
      await supabase.from('cart_items').update({ quantity }).eq('id', itemId);
      await refresh();
    },
    [refresh],
  );

  const removeItem = useCallback(
    async (itemId: string) => {
      await supabase.from('cart_items').delete().eq('id', itemId);
      await refresh();
    },
    [refresh],
  );

  const clearCart = useCallback(async () => {
    if (!user) return;
    await supabase.from('cart_items').delete().eq('user_id', user.id);
    await refresh();
  }, [user, refresh]);

  const count = items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, loading, count, addToCart, updateQuantity, removeItem, clearCart, refresh }}
    >
      {children}
    </CartContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
