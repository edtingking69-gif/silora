import { supabase } from '@/lib/supabase';
import type {
  Product, Category, PaymentMethod, Coupon, ShippingConfig, StoreConfig,
  Order, OrderItem, Payment, Address, Profile, Review,
  OrderStatusHistory, PaymentStatusHistory,
} from '@/types';

export async function fetchCategories(): Promise<Category[]> {
  const { data } = await supabase
    .from('categories')
    .select('*')
    .eq('is_active', true)
    .order('display_order');
  return (data as Category[]) ?? [];
}

export async function fetchAllCategoriesAdmin(): Promise<Category[]> {
  const { data } = await supabase.from('categories').select('*').order('display_order');
  return (data as Category[]) ?? [];
}

export async function fetchProductsByFlag(flag: 'is_featured' | 'is_bestseller' | 'is_trending' | 'is_new', limit = 10): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('is_active', true)
    .eq(flag, true)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data as Product[]) ?? [];
}

export async function fetchProducts(opts: {
  category?: string;
  search?: string;
  sort?: string;
  minPrice?: number;
  maxPrice?: number;
  inStock?: boolean;
  limit?: number;
  page?: number;
}): Promise<{ products: Product[]; total: number }> {
  const limit = opts.limit ?? 12;
  const page = opts.page ?? 1;
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  let query = supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`, { count: 'exact' })
    .eq('is_active', true);

  if (opts.category) {
    const { data: cat } = await supabase.from('categories').select('id').eq('slug', opts.category).maybeSingle();
    if (cat) query = query.eq('category_id', cat.id);
  }
  if (opts.search) {
    query = query.or(`name.ilike.%${opts.search}%,description.ilike.%${opts.search}%`);
  }
  if (opts.minPrice !== undefined) query = query.gte('price', opts.minPrice);
  if (opts.maxPrice !== undefined) query = query.lte('price', opts.maxPrice);
  if (opts.inStock) query = query.gt('stock', 0);

  switch (opts.sort) {
    case 'price-low': query = query.order('price', { ascending: true }); break;
    case 'price-high': query = query.order('price', { ascending: false }); break;
    case 'newest': query = query.order('created_at', { ascending: false }); break;
    case 'rating': query = query.order('rating', { ascending: false }); break;
    case 'popular': query = query.order('sales_count', { ascending: false }); break;
    default: query = query.order('created_at', { ascending: false });
  }

  query = query.range(from, to);
  const { data, count } = await query;
  return { products: (data as Product[]) ?? [], total: count ?? 0 };
}

export async function fetchProduct(id: string): Promise<Product | null> {
  const { data } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('id', id)
    .maybeSingle();
  return data as Product | null;
}

export async function fetchProductVariants(productId: string) {
  const { data } = await supabase
    .from('product_variants')
    .select('*')
    .eq('product_id', productId)
    .order('created_at');
  return data ?? [];
}

export async function fetchRelatedProducts(productId: string, categoryId: string | null, limit = 6): Promise<Product[]> {
  let query = supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .eq('is_active', true)
    .neq('id', productId)
    .limit(limit);
  if (categoryId) query = query.eq('category_id', categoryId);
  const { data } = await query;
  return (data as Product[]) ?? [];
}

export async function fetchPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await supabase
    .from('payment_methods')
    .select(`*, payment_qr_codes(*)`)
    .eq('enabled', true)
    .order('display_order');
  return (data as PaymentMethod[]) ?? [];
}

export async function fetchShippingConfig(): Promise<ShippingConfig> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'shipping').maybeSingle();
  const val = (data as { value: ShippingConfig } | null)?.value;
  return val ?? { enabled: true, shipping_fee: 0, free_shipping_threshold: 0, message: 'Free shipping on all orders' };
}

export async function fetchStoreConfig(): Promise<StoreConfig | null> {
  const { data } = await supabase.from('site_settings').select('value').eq('key', 'store').maybeSingle();
  return (data as { value: StoreConfig } | null)?.value ?? null;
}

export async function validateCoupon(code: string, subtotal: number): Promise<{ coupon: Coupon | null; discount: number; error: string | null }> {
  const { data } = await supabase
    .from('coupons')
    .select('*')
    .eq('code', code.toUpperCase())
    .eq('is_active', true)
    .maybeSingle();
  const coupon = data as Coupon | null;
  if (!coupon) return { coupon: null, discount: 0, error: 'Invalid coupon code' };
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return { coupon: null, discount: 0, error: 'Coupon expired' };
  if (coupon.max_usage && coupon.usage_count >= coupon.max_usage) return { coupon: null, discount: 0, error: 'Coupon usage limit reached' };
  if (subtotal < coupon.min_order) return { coupon: null, discount: 0, error: `Minimum order ₹${coupon.min_order} required` };

  let discount = 0;
  if (coupon.discount_type === 'percentage') {
    discount = Math.min((subtotal * coupon.discount_value) / 100, subtotal);
  } else {
    discount = Math.min(coupon.discount_value, subtotal);
  }
  return { coupon, discount: Math.round(discount * 100) / 100, error: null };
}

export async function fetchUserOrders(userId: string): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Order[]) ?? [];
}

export async function fetchOrderById(orderId: string, userId: string): Promise<Order | null> {
  const { data } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('id', orderId)
    .eq('user_id', userId)
    .maybeSingle();
  return data as Order | null;
}

export async function fetchPaymentsByOrder(orderId: string): Promise<Payment[]> {
  const { data } = await supabase
    .from('payments')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false });
  return (data as Payment[]) ?? [];
}

export async function fetchOrderStatusHistory(orderId: string): Promise<OrderStatusHistory[]> {
  const { data } = await supabase
    .from('order_status_history')
    .select('*')
    .eq('order_id', orderId)
    .order('created_at', { ascending: true });
  return (data as OrderStatusHistory[]) ?? [];
}

export async function fetchUserAddresses(userId: string): Promise<Address[]> {
  const { data } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', userId)
    .order('is_default', { ascending: false });
  return (data as Address[]) ?? [];
}

export async function fetchReviews(productId: string): Promise<Review[]> {
  const { data } = await supabase
    .from('reviews')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true)
    .order('created_at', { ascending: false });
  return (data as Review[]) ?? [];
}

// Admin services
export async function fetchAllProductsAdmin(): Promise<Product[]> {
  const { data } = await supabase
    .from('products')
    .select(`*, category:categories(*), product_images(*)`)
    .order('created_at', { ascending: false });
  return (data as Product[]) ?? [];
}

export async function fetchAdminOrders(): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .order('created_at', { ascending: false });
  return (data as Order[]) ?? [];
}

export async function fetchAdminOrderById(orderId: string): Promise<Order | null> {
  const { data } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('id', orderId)
    .maybeSingle();
  return data as Order | null;
}

export async function fetchAdminPayments(): Promise<Payment[]> {
  const { data } = await supabase
    .from('payments')
    .select('*, order:orders(order_number, customer_name)')
    .order('created_at', { ascending: false });
  return (data as Payment[]) ?? [];
}

export async function fetchAdminPaymentMethods(): Promise<PaymentMethod[]> {
  const { data } = await supabase.from('payment_methods').select(`*, payment_qr_codes(*)`).order('display_order');
  return (data as PaymentMethod[]) ?? [];
}

export async function fetchAdminCoupons(): Promise<Coupon[]> {
  const { data } = await supabase.from('coupons').select('*').order('created_at', { ascending: false });
  return (data as Coupon[]) ?? [];
}

export async function fetchAdminProfiles(): Promise<Profile[]> {
  const { data } = await supabase.from('profiles').select('*').order('created_at', { ascending: false });
  return (data as Profile[]) ?? [];
}

export async function fetchAdminAuditLogs(limit = 50) {
  const { data } = await supabase
    .from('admin_audit_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  return data ?? [];
}

export async function fetchPaymentStatusHistory(paymentId: string): Promise<PaymentStatusHistory[]> {
  const { data } = await supabase
    .from('payment_status_history')
    .select('*')
    .eq('payment_id', paymentId)
    .order('created_at', { ascending: true });
  return (data as PaymentStatusHistory[]) ?? [];
}
