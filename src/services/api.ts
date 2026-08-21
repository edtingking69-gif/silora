import { supabase } from '@/lib/supabase';
import type {
  Product, Category, PaymentMethod, Coupon, ShippingConfig, StoreConfig,
  Order, OrderItem, Payment, Address, Profile, Review,
  OrderStatusHistory, PaymentStatusHistory, DeliveryStatus, PaymentStatus,
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
    .neq('type', 'cod')
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

export async function fetchOrderById(orderId: string, userId?: string): Promise<Order | null> {
  let query = supabase
    .from('orders')
    .select(`*, order_items(*)`)
    .eq('id', orderId);

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

export interface PlaceOrderInput {
  userId: string;
  items: { product_id: string; variant_id?: string | null; quantity: number }[];
  address: {
    full_name: string;
    mobile: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    pincode: string;
    label?: string;
  };
  couponCode?: string | null;
  paymentMethodId: string;
}

export interface PlaceOrderResult {
  order_id: string;
  order_number: string;
  total: number;
  payment_method_name: string;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
}

export async function createOrder(input: PlaceOrderInput): Promise<PlaceOrderResult> {
  const { userId, items, address, couponCode, paymentMethodId } = input;

  if (!userId) throw new Error('User must be authenticated to place an order.');
  if (!items || items.length === 0) throw new Error('Cart is empty.');
  if (!address.full_name || !address.mobile || !address.line1 || !address.city || !address.state || !address.pincode) {
    throw new Error('Please provide complete delivery address details.');
  }

  // 1. Fetch & validate payment method (exclude COD)
  const { data: pmData, error: pmError } = await supabase
    .from('payment_methods')
    .select('*')
    .eq('id', paymentMethodId)
    .single();

  if (pmError || !pmData || pmData.type === 'cod') {
    throw new Error('Selected payment method is invalid or unavailable.');
  }
  const paymentMethod = pmData as PaymentMethod;

  // 2. Fetch authenticated user profile / email
  const { data: userProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', userId)
    .single();

  let userEmail = userProfile?.email;
  if (!userEmail) {
    const { data: authUser } = await supabase.auth.getUser();
    userEmail = authUser.user?.email || 'customer@silora.in';
  }

  // 3. Re-verify products and stock from database
  const productIds = items.map((i) => i.product_id);
  const { data: dbProducts, error: prodErr } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .in('id', productIds);

  if (prodErr || !dbProducts || dbProducts.length === 0) {
    throw new Error('Could not fetch items from database.');
  }

  const variantIds = items.map((i) => i.variant_id).filter(Boolean) as string[];
  let dbVariants: { id: string; product_id: string; name: string; value: string; price_override: number | null; stock: number }[] = [];
  if (variantIds.length > 0) {
    const { data: vData } = await supabase
      .from('product_variants')
      .select('*')
      .in('id', variantIds);
    dbVariants = vData ?? [];
  }

  let calculatedSubtotal = 0;
  const verifiedOrderItems: {
    product_id: string;
    product_name: string;
    product_image: string | null;
    variant_name: string | null;
    price: number;
    original_price: number | null;
    quantity: number;
  }[] = [];

  for (const item of items) {
    const product = dbProducts.find((p) => p.id === item.product_id);
    if (!product) {
      throw new Error(`Product is no longer available.`);
    }
    if (!product.is_active) {
      throw new Error(`Product "${product.name}" is currently not active.`);
    }

    let unitPrice = Number(product.price);
    const originalPrice = product.original_price ? Number(product.original_price) : null;
    let variantDesc: string | null = null;
    let availableStock = Number(product.stock);

    if (item.variant_id) {
      const variant = dbVariants.find((v) => v.id === item.variant_id);
      if (variant) {
        if (variant.price_override !== null && variant.price_override !== undefined) {
          unitPrice = Number(variant.price_override);
        }
        availableStock = Number(variant.stock);
        variantDesc = `${variant.name}: ${variant.value}`;
      }
    }

    if (item.quantity <= 0) {
      throw new Error(`Invalid quantity for "${product.name}".`);
    }

    if (availableStock < item.quantity) {
      throw new Error(`Insufficient stock for "${product.name}". Available: ${availableStock}`);
    }

    const firstImage = product.product_images?.[0]?.url || null;

    calculatedSubtotal += unitPrice * item.quantity;
    verifiedOrderItems.push({
      product_id: product.id,
      product_name: product.name,
      product_image: firstImage,
      variant_name: variantDesc,
      price: unitPrice,
      original_price: originalPrice,
      quantity: item.quantity,
    });
  }

  // 4. Calculate coupon discount
  let calculatedDiscount = 0;
  let validatedCouponCode: string | null = null;
  if (couponCode && couponCode.trim()) {
    const couponValidation = await validateCoupon(couponCode, calculatedSubtotal);
    if (couponValidation.coupon && !couponValidation.error) {
      calculatedDiscount = couponValidation.discount;
      validatedCouponCode = couponValidation.coupon.code;
    }
  }

  // 5. Calculate shipping
  const shippingConfig = await fetchShippingConfig();
  const freeThreshold = shippingConfig.free_shipping_threshold ?? 0;
  const isFree = shippingConfig.enabled && (freeThreshold === 0 || calculatedSubtotal >= freeThreshold);
  const calculatedShipping = isFree ? 0 : (shippingConfig.shipping_fee ?? 0);

  const calculatedTotal = Math.max(0, Math.round((calculatedSubtotal - calculatedDiscount + calculatedShipping) * 100) / 100);

  // Generate unique order number
  const orderNumber = 'SL' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).substring(2, 6).toUpperCase();

  const initialPaymentStatus: PaymentStatus = 'Pending';
  const initialDeliveryStatus: DeliveryStatus = 'Pending';

  // 6. Insert order record
  const { data: newOrder, error: orderInsertError } = await supabase
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
      subtotal: calculatedSubtotal,
      discount: calculatedDiscount,
      shipping: calculatedShipping,
      total: calculatedTotal,
      coupon_code: validatedCouponCode,
      payment_method_id: paymentMethod.id,
      payment_method_name: paymentMethod.name,
      payment_status: initialPaymentStatus,
      delivery_status: initialDeliveryStatus,
    })
    .select('*')
    .single();

  if (orderInsertError || !newOrder) {
    throw new Error(orderInsertError?.message || 'Failed to create order record.');
  }

  const orderId = newOrder.id;

  // 7. Insert order items
  const itemsToInsert = verifiedOrderItems.map((item) => ({
    order_id: orderId,
    product_id: item.product_id,
    product_name: item.product_name,
    product_image: item.product_image,
    variant_name: item.variant_name,
    price: item.price,
    original_price: item.original_price,
    quantity: item.quantity,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(itemsToInsert);

  if (itemsError) {
    await supabase.from('orders').delete().eq('id', orderId);
    throw new Error('Failed to create order items: ' + itemsError.message);
  }

  // 8. Create initial payment entry
  await supabase
    .from('payments')
    .insert({
      order_id: orderId,
      user_id: userId,
      payment_method_id: paymentMethod.id,
      payment_method_name: paymentMethod.name,
      amount: calculatedTotal,
      status: initialPaymentStatus,
    });

  // 9. Update stock & coupon usage
  for (const item of items) {
    const prod = dbProducts.find((p) => p.id === item.product_id);
    if (prod) {
      await supabase.from('products').update({
        stock: Math.max(0, prod.stock - item.quantity),
        sales_count: (prod.sales_count || 0) + item.quantity,
      }).eq('id', prod.id);
    }
    if (item.variant_id) {
      const v = dbVariants.find((vr) => vr.id === item.variant_id);
      if (v) {
        await supabase.from('product_variants').update({
          stock: Math.max(0, v.stock - item.quantity),
        }).eq('id', v.id);
      }
    }
  }

  if (validatedCouponCode) {
    const { data: coup } = await supabase
      .from('coupons')
      .select('id, usage_count')
      .eq('code', validatedCouponCode)
      .maybeSingle();
    if (coup) {
      await supabase.from('coupons').update({
        usage_count: (coup.usage_count || 0) + 1,
      }).eq('id', coup.id);
    }
  }

  // 10. Clear user's cart in database
  await supabase.from('cart_items').delete().eq('user_id', userId);

  return {
    order_id: orderId,
    order_number: orderNumber,
    total: calculatedTotal,
    payment_method_name: paymentMethod.name,
    payment_status: initialPaymentStatus,
    delivery_status: initialDeliveryStatus,
  };
}

export async function submitOrderPayment(
  orderId: string,
  paymentMethodId: string,
  reference?: string | null,
): Promise<void> {
  const newStatus: PaymentStatus = 'Payment Submitted';

  // 1. Update order payment status
  await supabase
    .from('orders')
    .update({ payment_status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', orderId);

  // 2. Update payment record
  await supabase
    .from('payments')
    .update({
      status: newStatus,
      payment_reference: reference || null,
      submitted_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('order_id', orderId);

  // 3. Log history entry
  const { data: existingPayment } = await supabase
    .from('payments')
    .select('id')
    .eq('order_id', orderId)
    .maybeSingle();

  if (existingPayment) {
    await supabase.from('payment_status_history').insert({
      payment_id: existingPayment.id,
      previous_status: 'Pending',
      new_status: newStatus,
      note: reference ? `Customer reference: ${reference}` : 'Submitted by customer (Awaiting verification between 6:00 PM - 10:00 PM)',
    });
  }
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