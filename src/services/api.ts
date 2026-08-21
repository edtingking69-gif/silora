import { supabase } from '@/lib/supabase';
import type {
  Product, Category, PaymentMethod, Coupon, ShippingConfig, StoreConfig,
  Order, OrderItem, Payment, Address, Profile, Review,
  OrderStatusHistory, PaymentStatusHistory,
} from '@/types';
import { getOrderNumber } from '@/utils/format';

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

export interface CreateOrderParams {
  userId: string;
  userEmail: string;
  items: Array<{
    product_id: string;
    variant_id: string | null;
    quantity: number;
  }>;
  address: {
    full_name: string;
    mobile: string;
    line1: string;
    line2?: string | null;
    city: string;
    state: string;
    pincode: string;
  };
  paymentMethodId: string;
  couponCode?: string | null;
}

export async function createOrder(params: CreateOrderParams): Promise<{
  order: Order;
  orderNumber: string;
  orderId: string;
  total: number;
  paymentMethodName: string;
}> {
  const { userId, userEmail, items, address, paymentMethodId, couponCode } = params;

  if (!items || items.length === 0) {
    throw new Error('Your cart is empty. Please add products to proceed.');
  }

  // 1. Try create_order RPC first
  try {
    const { data: rpcData, error: rpcError } = await supabase.rpc('create_order', {
      p_items: items,
      p_address: {
        full_name: address.full_name,
        mobile: address.mobile,
        line1: address.line1,
        line2: address.line2 || '',
        city: address.city,
        state: address.state,
        pincode: address.pincode,
      },
      p_coupon_code: couponCode || null,
      p_payment_method_id: paymentMethodId,
    });

    if (!rpcError && rpcData) {
      const res = rpcData as { order_id: string; order_number: string };
      const { data: createdOrder } = await supabase
        .from('orders')
        .select('*, order_items(*)')
        .eq('id', res.order_id)
        .single();

      if (createdOrder) {
        // Clear cart items from database
        await supabase.from('cart_items').delete().eq('user_id', userId);
        return {
          order: createdOrder as Order,
          orderId: createdOrder.id,
          orderNumber: createdOrder.order_number,
          total: Number(createdOrder.total),
          paymentMethodName: createdOrder.payment_method_name || 'UPI',
        };
      }
    }
  } catch (rpcErr) {
    console.warn('RPC create_order not used or failed, using database transaction fallback:', rpcErr);
  }

  // 2. Client-side database transaction fallback (validating server data directly from Supabase tables)
  // Fetch fresh product data from Supabase to prevent client tampering
  const productIds = items.map((i) => i.product_id);
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select(`*, product_images(*)`)
    .in('id', productIds);

  if (prodErr || !dbProducts || dbProducts.length === 0) {
    throw new Error('Unable to retrieve products. Please refresh and try again.');
  }

  // Fetch variant data if variants are selected
  const variantIds = items.map((i) => i.variant_id).filter(Boolean) as string[];
  let dbVariants: Array<{ id: string; name: string; value: string; price_override: number | null; stock: number }> = [];
  if (variantIds.length > 0) {
    const { data: variantsData } = await supabase
      .from('product_variants')
      .select('*')
      .in('id', variantIds);
    if (variantsData) dbVariants = variantsData;
  }

  // Validate active status, stock, and calculate subtotal
  let subtotal = 0;
  const verifiedItems: Array<{
    product_id: string;
    product_name: string;
    product_image: string | null;
    variant_name: string | null;
    price: number;
    original_price: number | null;
    quantity: number;
  }> = [];

  for (const item of items) {
    const product = dbProducts.find((p) => p.id === item.product_id);
    if (!product) {
      throw new Error('One or more products in your cart could not be found.');
    }
    if (!product.is_active) {
      throw new Error(`"${product.name}" is no longer available.`);
    }

    const variant = item.variant_id ? dbVariants.find((v) => v.id === item.variant_id) : null;
    const availableStock = variant ? variant.stock : product.stock;

    if (availableStock < item.quantity) {
      throw new Error(
        `Insufficient stock for "${product.name}"${variant ? ` (${variant.name}: ${variant.value})` : ''}. Only ${availableStock} left.`,
      );
    }

    const unitPrice = variant?.price_override ? Number(variant.price_override) : Number(product.price);
    const itemTotal = unitPrice * item.quantity;
    subtotal += itemTotal;

    const imageUrl = product.product_images?.[0]?.url || null;

    verifiedItems.push({
      product_id: product.id,
      product_name: product.name,
      product_image: imageUrl,
      variant_name: variant ? `${variant.name}: ${variant.value}` : null,
      price: unitPrice,
      original_price: product.original_price ? Number(product.original_price) : null,
      quantity: item.quantity,
    });
  }

  // Calculate discount from coupon if provided
  let discount = 0;
  if (couponCode) {
    const couponValidation = await validateCoupon(couponCode, subtotal);
    if (couponValidation.coupon) {
      discount = couponValidation.discount;
      // Increment usage count
      await supabase
        .from('coupons')
        .update({ usage_count: (couponValidation.coupon.usage_count || 0) + 1 })
        .eq('id', couponValidation.coupon.id);
    }
  }

  // Calculate shipping from DB settings
  const shippingConfig = await fetchShippingConfig();
  const shippingFee = shippingConfig.shipping_fee || 0;
  const freeThreshold = shippingConfig.free_shipping_threshold || 0;
  const isFree = shippingConfig.enabled && (freeThreshold === 0 || subtotal >= freeThreshold);
  const shipping = isFree ? 0 : shippingFee;

  const total = Math.max(0, subtotal - discount + shipping);

  // Fetch payment method name
  const { data: pmData } = await supabase
    .from('payment_methods')
    .select('name, type')
    .eq('id', paymentMethodId)
    .maybeSingle();

  const paymentMethodName = pmData?.name || 'UPI';
  const orderNumber = getOrderNumber();

  // Create Order in DB
  const { data: orderData, error: orderErr } = await supabase
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: userId,
      customer_name: address.full_name,
      email: userEmail,
      mobile: address.mobile,
      address_line1: address.line1,
      address_line2: address.line2 || null,
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      subtotal,
      discount,
      shipping,
      total,
      coupon_code: couponCode || null,
      payment_method_id: paymentMethodId,
      payment_method_name: paymentMethodName,
      payment_status: 'Pending',
      delivery_status: 'Pending',
    })
    .select()
    .single();

  if (orderErr || !orderData) {
    throw new Error(orderErr?.message || 'Failed to create order record. Please try again.');
  }

  const orderId = orderData.id;

  // Insert Order Items
  const orderItemsToInsert = verifiedItems.map((vi) => ({
    order_id: orderId,
    product_id: vi.product_id,
    product_name: vi.product_name,
    product_image: vi.product_image,
    variant_name: vi.variant_name,
    price: vi.price,
    original_price: vi.original_price,
    quantity: vi.quantity,
  }));

  const { error: itemsErr } = await supabase.from('order_items').insert(orderItemsToInsert);
  if (itemsErr) {
    console.error('Error inserting order items:', itemsErr);
  }

  // Insert initial payment record
  await supabase.from('payments').insert({
    order_id: orderId,
    user_id: userId,
    payment_method_id: paymentMethodId,
    payment_method_name: paymentMethodName,
    amount: total,
    status: 'Pending',
  });

  // Insert initial status history
  await supabase.from('order_status_history').insert({
    order_id: orderId,
    previous_status: null,
    new_status: 'Pending',
    note: 'Order created',
  });

  // Deduct stock for items
  for (const item of items) {
    const product = dbProducts.find((p) => p.id === item.product_id);
    if (product) {
      await supabase
        .from('products')
        .update({
          stock: Math.max(0, product.stock - item.quantity),
          sales_count: (product.sales_count || 0) + item.quantity,
        })
        .eq('id', product.id);
    }
  }

  // Clear customer cart from database
  await supabase.from('cart_items').delete().eq('user_id', userId);

  return {
    order: orderData as Order,
    orderId,
    orderNumber,
    total,
    paymentMethodName,
  };
}

export async function submitPaymentReference(orderId: string, paymentMethodId: string, reference?: string): Promise<void> {
  // Try RPC
  try {
    const { error } = await supabase.rpc('submit_payment', {
      p_order_id: orderId,
      p_payment_method_id: paymentMethodId,
      p_payment_reference: reference || null,
    });
    if (!error) return;
  } catch (e) {
    console.warn('RPC submit_payment failed, updating database tables directly', e);
  }

  // Direct table update fallback
  await supabase
    .from('orders')
    .update({ payment_status: 'Payment Submitted' })
    .eq('id', orderId);

  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existingPayment) {
    await supabase
      .from('payments')
      .update({
        status: 'Payment Submitted',
        payment_reference: reference || null,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', existingPayment.id);
  }
}

export async function fetchUserOrders(userId: string): Promise<Order[]> {
  const { data } = await supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  return (data as Order[]) ?? [];
}

export async function fetchOrderById(orderIdOrNumber: string, userId?: string): Promise<Order | null> {
  let query = supabase
    .from('orders')
    .select(`*, order_items(*)`);

  if (orderIdOrNumber.includes('-') && orderIdOrNumber.length > 20) {
    query = query.eq('id', orderIdOrNumber);
  } else {
    query = query.or(`id.eq.${orderIdOrNumber},order_number.eq.${orderIdOrNumber}`);
  }

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data } = await query.maybeSingle();
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