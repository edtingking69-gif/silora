export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  mobile: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type UserRole = 'customer' | 'admin';

export interface UserRoleRow {
  id: string;
  user_id: string;
  role: UserRole;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;

  price: number;
  original_price: number | null;
  stock: number;

  sku: string | null;
  category_id: string | null;

  // Product flags
  is_featured: boolean;
  is_bestseller: boolean;
  is_trending: boolean;

  // IMPORTANT: Matches your Supabase column
  is_new_arrival: boolean;

  is_active: boolean;

  // Optional because these columns were not present
  // in the products table structure you showed
  rating?: number;
  review_count?: number;
  sales_count?: number;

  created_at: string;
  updated_at: string;

  category?: Category | null;
  product_images?: ProductImage[];
}

export interface ProductImage {
  id: string;
  product_id: string;
  url: string;
  alt: string | null;
  display_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  value: string;
  price_override: number | null;
  stock: number;
  created_at: string;
}

export interface CartItem {
  id: string;
  user_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  created_at: string;

  product?: Product;
  variant?: ProductVariant | null;
}

export interface Address {
  id: string;
  user_id: string;
  label: string;
  full_name: string;
  mobile: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export type PaymentStatus =
  | 'Pending'
  | 'pending'
  | 'pending_verification'
  | 'Payment Submitted'
  | 'Under Verification'
  | 'Paid'
  | 'paid'
  | 'rejected'
  | 'Failed'
  | 'Refunded'
  | 'Cancelled';

export type DeliveryStatus =
  | 'Pending'
  | 'pending'
  | 'Confirmed'
  | 'Processing'
  | 'Packed'
  | 'Shipped'
  | 'Out for Delivery'
  | 'Delivered'
  | 'Cancelled'
  | 'Returned';

export interface Order {
  id: string;
  order_number: string;
  user_id: string;

  customer_name: string;
  email: string;
  mobile: string | null;

  address_line1: string;
  address_line2: string | null;
  city: string;
  state: string;
  pincode: string;

  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  amount_paid: number | null;

  coupon_code: string | null;

  payment_method_id: string | null;
  payment_method_name: string | null;

  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;

  payment_proof_path: string | null;

  tracking_number: string | null;
  courier: string | null;
  delivery_notes: string | null;

  created_at: string;
  updated_at: string;

  order_items?: OrderItem[];
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;

  product_name: string;
  product_image: string | null;

  variant_name: string | null;

  price: number;
  original_price: number | null;
  quantity: number;

  created_at: string;
}

export interface Payment {
  id: string;
  order_id: string;
  user_id: string;

  payment_method_id: string | null;
  payment_method_name: string | null;

  amount: number;
  status: PaymentStatus;

  payment_reference: string | null;

  submitted_at: string | null;
  verified_at: string | null;
  verified_by: string | null;

  created_at: string;
  updated_at: string;
}

export type PaymentMethodType =
  | 'upi'
  | 'upi_qr'
  | 'cod'
  | 'gateway'
  | 'other';

export interface PaymentMethod {
  id: string;
  name: string;
  type: PaymentMethodType;

  description: string | null;
  instructions: string | null;

  upi_id: string | null;

  enabled: boolean;
  display_order: number;

  created_at: string;
  updated_at: string;

  payment_qr_codes?: PaymentQrCode[];
}

export interface PaymentQrCode {
  id: string;
  payment_method_id: string;

  name: string;
  description: string | null;

  image_url: string;

  enabled: boolean;
  display_order: number;

  created_at: string;
  updated_at: string;
}

export interface OrderStatusHistory {
  id: string;
  order_id: string;

  previous_status: string | null;
  new_status: DeliveryStatus;

  changed_by: string | null;
  note: string | null;

  created_at: string;
}

export interface PaymentStatusHistory {
  id: string;
  payment_id: string;

  previous_status: string | null;
  new_status: PaymentStatus;

  changed_by: string | null;
  note: string | null;

  created_at: string;
}

export interface SiteSettings {
  [key: string]: Record<string, unknown>;
}

export interface Coupon {
  id: string;

  code: string;
  description: string | null;

  discount_type: 'percentage' | 'fixed';
  discount_value: number;

  min_order: number;

  max_usage: number | null;
  usage_count: number;

  expires_at: string | null;

  is_active: boolean;

  created_at: string;
  updated_at: string;
}

export interface AdminAuditLog {
  id: string;

  admin_id: string | null;

  action: string;
  target: string | null;
  target_id: string | null;

  details: Record<string, unknown> | null;

  created_at: string;
}

export interface Review {
  id: string;

  product_id: string;
  user_id: string;

  rating: number;

  title: string | null;
  body: string | null;

  author_name: string | null;

  is_active: boolean;

  created_at: string;
}

export interface ShippingConfig {
  enabled: boolean;
  shipping_fee: number;
  free_shipping_threshold: number;
  message: string;
}

export interface StoreConfig {
  name: string;
  tagline: string;
  support_email: string;
  support_phone: string;
}

export interface RevenueSummary {
  total: number;
  today: number;
  week: number;
  month: number;
  year: number;

  paid_orders: number;
  total_orders: number;
  pending_payments: number;

  aov: number;

  refunds: number;
  net: number;
}

export interface RevenuePoint {
  day?: string;
  month?: string;
  label?: string;

  revenue: number;
  orders: number;
}

export interface RevenueBreakdown {
  method?: string;
  category?: string;

  revenue: number;
  orders?: number;
}