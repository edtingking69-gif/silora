/*
# SILORA E-Commerce Schema — Initial Setup

## Overview
Creates the full database schema for SILORA, a multi-category Indian e-commerce platform with customer storefront and admin portal.

## Tables Created
1. profiles — Customer profile data linked to auth.users
2. user_roles — Role assignment (customer / admin). Users cannot self-assign admin.
3. categories — Product categories
4. products — Products with price, stock, flags
5. product_variants — Variant options per product
6. product_images — Multiple images per product
7. cart_items — Shopping cart per user
8. addresses — Saved delivery addresses
9. orders — Orders with totals, statuses, tracking
10. order_items — Line items snapshot
11. payments — Payment records per order
12. payment_methods — Configurable payment methods
13. payment_qr_codes — QR codes for payment methods
14. order_status_history — Delivery status audit trail
15. payment_status_history — Payment status audit trail
16. site_settings — Key-value store (shipping config)
17. coupons — Discount codes
18. admin_audit_logs — Admin action audit
19. reviews — Customer product reviews
20. storage bucket silora — public bucket for images

## Security
- RLS on every table. is_admin() SECURITY DEFINER helper checks user_roles.
- Customers access only their own data. Public can read active products/categories.
- Admin-only writes guarded by is_admin(). Users cannot self-assign admin role.
*/

-- ============================================================
-- profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  full_name text,
  mobile text,
  avatar_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_own" ON public.profiles;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- ============================================================
-- user_roles (created BEFORE is_admin function)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('customer','admin')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "user_roles_select_self_or_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_self_or_admin" ON public.user_roles FOR SELECT
  TO authenticated USING (auth.uid() = user_id);
-- NOTE: admin reads of user_roles handled via set_admin_role RPC below; is_admin uses SECURITY DEFINER.

-- ============================================================
-- HELPER: is_admin() — must come AFTER user_roles table
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  );
$$;

-- Now grant admin SELECT on user_roles via a separate policy
DROP POLICY IF EXISTS "user_roles_select_admin" ON public.user_roles;
CREATE POLICY "user_roles_select_admin" ON public.user_roles FOR SELECT
  TO authenticated USING (public.is_admin());

-- ============================================================
-- Trigger: auto-create profile + customer role on signup
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'customer')
  ON CONFLICT (user_id, role) DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Admin management RPCs (set / remove admin role)
-- Only existing admins can call these.
-- ============================================================
CREATE OR REPLACE FUNCTION public.set_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  INSERT INTO public.user_roles (user_id, role) VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE admin_count int;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last administrator';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin';
END;
$$;

-- ============================================================
-- categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  description text,
  image_url text,
  display_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "categories_public_read" ON public.categories;
CREATE POLICY "categories_public_read" ON public.categories FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "categories_admin_write" ON public.categories;
CREATE POLICY "categories_admin_write" ON public.categories FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- products
-- ============================================================
CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL,
  description text,
  price numeric(12,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  original_price numeric(12,2) CHECK (original_price IS NULL OR original_price >= 0),
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  sku text,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  is_featured boolean NOT NULL DEFAULT false,
  is_bestseller boolean NOT NULL DEFAULT false,
  is_trending boolean NOT NULL DEFAULT false,
  is_new boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  rating numeric(2,1) DEFAULT 0,
  review_count int DEFAULT 0,
  sales_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_public_read" ON public.products;
CREATE POLICY "products_public_read" ON public.products FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "products_admin_read" ON public.products;
CREATE POLICY "products_admin_read" ON public.products FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "products_admin_write" ON public.products;
CREATE POLICY "products_admin_write" ON public.products FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_products_slug ON public.products(slug);

-- ============================================================
-- product_variants
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_variants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  name text NOT NULL,
  value text NOT NULL,
  price_override numeric(12,2) CHECK (price_override IS NULL OR price_override >= 0),
  stock int NOT NULL DEFAULT 0 CHECK (stock >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_variants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "variants_public_read" ON public.product_variants;
CREATE POLICY "variants_public_read" ON public.product_variants FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_variants.product_id AND p.is_active = true)
  );

DROP POLICY IF EXISTS "variants_admin_read" ON public.product_variants;
CREATE POLICY "variants_admin_read" ON public.product_variants FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "variants_admin_write" ON public.product_variants;
CREATE POLICY "variants_admin_write" ON public.product_variants FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- product_images
-- ============================================================
CREATE TABLE IF NOT EXISTS public.product_images (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  url text NOT NULL,
  alt text,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.product_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "images_public_read" ON public.product_images;
CREATE POLICY "images_public_read" ON public.product_images FOR SELECT
  TO anon, authenticated USING (
    EXISTS (SELECT 1 FROM public.products p WHERE p.id = product_images.product_id AND p.is_active = true)
  );

DROP POLICY IF EXISTS "images_admin_read" ON public.product_images;
CREATE POLICY "images_admin_read" ON public.product_images FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "images_admin_write" ON public.product_images;
CREATE POLICY "images_admin_write" ON public.product_images FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_product_images_product ON public.product_images(product_id);

-- ============================================================
-- cart_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.cart_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  variant_id uuid REFERENCES public.product_variants(id) ON DELETE SET NULL,
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.cart_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cart_select_own" ON public.cart_items;
CREATE POLICY "cart_select_own" ON public.cart_items FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_insert_own" ON public.cart_items;
CREATE POLICY "cart_insert_own" ON public.cart_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_update_own" ON public.cart_items;
CREATE POLICY "cart_update_own" ON public.cart_items FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "cart_delete_own" ON public.cart_items;
CREATE POLICY "cart_delete_own" ON public.cart_items FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- addresses
-- ============================================================
CREATE TABLE IF NOT EXISTS public.addresses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL DEFAULT 'Home',
  full_name text NOT NULL,
  mobile text NOT NULL,
  line1 text NOT NULL,
  line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.addresses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "addr_select_own" ON public.addresses;
CREATE POLICY "addr_select_own" ON public.addresses FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "addr_admin_select" ON public.addresses;
CREATE POLICY "addr_admin_select" ON public.addresses FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "addr_insert_own" ON public.addresses;
CREATE POLICY "addr_insert_own" ON public.addresses FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addr_update_own" ON public.addresses;
CREATE POLICY "addr_update_own" ON public.addresses FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "addr_delete_own" ON public.addresses;
CREATE POLICY "addr_delete_own" ON public.addresses FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- ============================================================
-- payment_methods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text NOT NULL CHECK (type IN ('upi','upi_qr','cod','gateway','other')),
  description text,
  instructions text,
  upi_id text,
  enabled boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pm_public_read" ON public.payment_methods;
CREATE POLICY "pm_public_read" ON public.payment_methods FOR SELECT
  TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "pm_admin_read" ON public.payment_methods;
CREATE POLICY "pm_admin_read" ON public.payment_methods FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "pm_admin_write" ON public.payment_methods;
CREATE POLICY "pm_admin_write" ON public.payment_methods FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- payment_qr_codes
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_qr_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_method_id uuid NOT NULL REFERENCES public.payment_methods(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  image_url text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_qr_codes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qr_public_read" ON public.payment_qr_codes;
CREATE POLICY "qr_public_read" ON public.payment_qr_codes FOR SELECT
  TO anon, authenticated USING (enabled = true);

DROP POLICY IF EXISTS "qr_admin_read" ON public.payment_qr_codes;
CREATE POLICY "qr_admin_read" ON public.payment_qr_codes FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "qr_admin_write" ON public.payment_qr_codes;
CREATE POLICY "qr_admin_write" ON public.payment_qr_codes FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- orders
-- ============================================================
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE RESTRICT,
  customer_name text NOT NULL,
  email text NOT NULL,
  mobile text,
  address_line1 text NOT NULL,
  address_line2 text,
  city text NOT NULL,
  state text NOT NULL,
  pincode text NOT NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount numeric(12,2) NOT NULL DEFAULT 0,
  shipping numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  coupon_code text,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_method_name text,
  payment_status text NOT NULL DEFAULT 'Pending' CHECK (payment_status IN ('Pending','Payment Submitted','Under Verification','Paid','Failed','Refunded','Cancelled')),
  delivery_status text NOT NULL DEFAULT 'Pending' CHECK (delivery_status IN ('Pending','Confirmed','Processing','Packed','Shipped','Out for Delivery','Delivered','Cancelled','Returned')),
  tracking_number text,
  courier text,
  delivery_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin" ON public.orders FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Note: order creation happens via create_order RPC (SECURITY DEFINER) which inserts with service-level privileges.
-- We grant INSERT on orders to authenticated so the RPC can operate; customers won't insert directly because
-- the create_order function validates and recalculates. Direct inserts by customers are blocked by lack of
-- a permissive insert policy (only the RPC path is used). To allow the RPC (which runs as caller by default
-- unless SECURITY DEFINER), we mark create_order as SECURITY DEFINER.

CREATE INDEX IF NOT EXISTS idx_orders_user ON public.orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_number ON public.orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_payment_status ON public.orders(payment_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_status ON public.orders(delivery_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON public.orders(created_at DESC);

-- ============================================================
-- order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  product_name text NOT NULL,
  product_image text,
  variant_name text,
  price numeric(12,2) NOT NULL DEFAULT 0,
  original_price numeric(12,2),
  quantity int NOT NULL DEFAULT 1 CHECK (quantity > 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "order_items_select_own_or_admin" ON public.order_items;
CREATE POLICY "order_items_select_own_or_admin" ON public.order_items FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_items.order_id AND (o.user_id = auth.uid() OR public.is_admin()))
  );

CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);

-- ============================================================
-- payments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  payment_method_id uuid REFERENCES public.payment_methods(id) ON DELETE SET NULL,
  payment_method_name text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Payment Submitted','Under Verification','Paid','Failed','Refunded','Cancelled')),
  payment_reference text,
  submitted_at timestamptz,
  verified_at timestamptz,
  verified_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payments_select_own_or_admin" ON public.payments;
CREATE POLICY "payments_select_own_or_admin" ON public.payments FOR SELECT
  TO authenticated USING (auth.uid() = user_id OR public.is_admin());

DROP POLICY IF EXISTS "payments_admin_update" ON public.payments;
CREATE POLICY "payments_admin_update" ON public.payments FOR UPDATE
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON public.payments(status);

-- ============================================================
-- order_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.order_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.order_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "osh_select_own_or_admin" ON public.order_status_history;
CREATE POLICY "osh_select_own_or_admin" ON public.order_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_status_history.order_id AND (o.user_id = auth.uid() OR public.is_admin()))
  );

CREATE INDEX IF NOT EXISTS idx_osh_order ON public.order_status_history(order_id);

-- ============================================================
-- payment_status_history
-- ============================================================
CREATE TABLE IF NOT EXISTS public.payment_status_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  previous_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.payment_status_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "psh_select_own_or_admin" ON public.payment_status_history;
CREATE POLICY "psh_select_own_or_admin" ON public.payment_status_history FOR SELECT
  TO authenticated USING (
    EXISTS (SELECT 1 FROM public.payments p WHERE p.id = payment_status_history.payment_id AND (p.user_id = auth.uid() OR public.is_admin()))
  );

CREATE INDEX IF NOT EXISTS idx_psh_payment ON public.payment_status_history(payment_id);

-- ============================================================
-- site_settings (key-value)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "settings_public_read" ON public.site_settings;
CREATE POLICY "settings_public_read" ON public.site_settings FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "settings_admin_write" ON public.site_settings;
CREATE POLICY "settings_admin_write" ON public.site_settings FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- coupons
-- ============================================================
CREATE TABLE IF NOT EXISTS public.coupons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  description text,
  discount_type text NOT NULL CHECK (discount_type IN ('percentage','fixed')),
  discount_value numeric(12,2) NOT NULL DEFAULT 0 CHECK (discount_value >= 0),
  min_order numeric(12,2) NOT NULL DEFAULT 0,
  max_usage int,
  usage_count int NOT NULL DEFAULT 0,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.coupons ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "coupons_public_read" ON public.coupons;
CREATE POLICY "coupons_public_read" ON public.coupons FOR SELECT
  TO anon, authenticated USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));

DROP POLICY IF EXISTS "coupons_admin_read" ON public.coupons;
CREATE POLICY "coupons_admin_read" ON public.coupons FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "coupons_admin_write" ON public.coupons;
CREATE POLICY "coupons_admin_write" ON public.coupons FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- admin_audit_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  target text,
  target_id text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.admin_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_admin_select" ON public.admin_audit_logs;
CREATE POLICY "audit_admin_select" ON public.admin_audit_logs FOR SELECT
  TO authenticated USING (public.is_admin());

DROP POLICY IF EXISTS "audit_admin_insert" ON public.admin_audit_logs;
CREATE POLICY "audit_admin_insert" ON public.admin_audit_logs FOR INSERT
  TO authenticated WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_audit_created ON public.admin_audit_logs(created_at DESC);

-- ============================================================
-- reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id uuid NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
  rating int NOT NULL DEFAULT 5 CHECK (rating >= 1 AND rating <= 5),
  title text,
  body text,
  author_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "reviews_public_read" ON public.reviews;
CREATE POLICY "reviews_public_read" ON public.reviews FOR SELECT
  TO anon, authenticated USING (is_active = true);

DROP POLICY IF EXISTS "reviews_insert_own" ON public.reviews;
CREATE POLICY "reviews_insert_own" ON public.reviews FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "reviews_admin_write" ON public.reviews;
CREATE POLICY "reviews_admin_write" ON public.reviews FOR ALL
  TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE INDEX IF NOT EXISTS idx_reviews_product ON public.reviews(product_id);

-- ============================================================
-- updated_at trigger helper
-- ============================================================
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY['profiles','categories','products','payment_methods','payment_qr_codes','orders','payments','addresses','coupons','site_settings']) LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_touch_%s ON public.%s;', t, t);
    EXECUTE format('CREATE TRIGGER trg_touch_%s BEFORE UPDATE ON public.%s FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();', t, t);
  END LOOP;
END $$;

-- ============================================================
-- Storage bucket
-- ============================================================
INSERT INTO storage.buckets (id, name, public) VALUES ('silora', 'silora', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
CREATE POLICY "storage_public_read" ON storage.objects FOR SELECT
  TO anon, authenticated USING (bucket_id = 'silora');

DROP POLICY IF EXISTS "storage_admin_write" ON storage.objects;
CREATE POLICY "storage_admin_write" ON storage.objects FOR INSERT
  TO authenticated WITH CHECK (bucket_id = 'silora' AND public.is_admin());

DROP POLICY IF EXISTS "storage_admin_update" ON storage.objects;
CREATE POLICY "storage_admin_update" ON storage.objects FOR UPDATE
  TO authenticated USING (bucket_id = 'silora' AND public.is_admin());

DROP POLICY IF EXISTS "storage_admin_delete" ON storage.objects;
CREATE POLICY "storage_admin_delete" ON storage.objects FOR DELETE
  TO authenticated USING (bucket_id = 'silora' AND public.is_admin());

-- ============================================================
-- Default site settings: shipping config
-- ============================================================
INSERT INTO public.site_settings (key, value) VALUES
  ('shipping', '{"charge": 49, "free_threshold": 2500, "free_enabled": true}'::jsonb),
  ('store', '{"name": "SILORA", "tagline": "Premium Online Shopping", "support_email": "support@silora.in", "support_phone": ""}'::jsonb)
ON CONFLICT (key) DO NOTHING;
