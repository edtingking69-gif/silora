/*
# SILORA Order & Payment RPCs

## Overview
Secure server-side functions for order creation and payment submission.
Prices are recalculated from the database — the browser cannot supply prices.

## Functions
1. create_order(p_items, p_address, p_coupon_code, p_payment_method_id)
   - Recalculates subtotal from live product prices
   - Applies coupon discount (validated server-side)
   - Computes shipping from site_settings
   - Creates order + order_items atomically
   - Decrements product stock
   - Increments coupon usage
   - Returns the new order row
   - Caller must be authenticated; order is owned by caller

2. submit_payment(p_order_id, p_payment_method_id, p_payment_reference)
   - Creates a payment record for an order
   - Sets status to 'Payment Submitted'
   - Updates order.payment_status to 'Payment Submitted'
   - Records payment_status_history
   - Only the order owner can submit

3. log_admin_action(p_action, p_target, p_target_id, p_details)
   - Inserts an audit log row; only admins

4. update_order_delivery_status(p_order_id, p_new_status, p_courier, p_tracking, p_note)
   - Admin-only: changes delivery status, records history, sets courier/tracking

5. update_payment_status(p_payment_id, p_new_status, p_note)
   - Admin-only: changes payment status, records history, sets verified_at/by if Paid
*/

-- ============================================================
-- create_order
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_order(
  p_items jsonb,
  p_address jsonb,
  p_coupon_code text DEFAULT NULL,
  p_payment_method_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order_id uuid;
  v_order_number text;
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_shipping numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_shipping_charge numeric;
  v_free_threshold numeric;
  v_free_enabled boolean;
  v_coupon record;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_price numeric(12,2);
  v_orig numeric(12,2);
  v_qty int;
  v_img text;
  v_uid uuid := auth.uid();
  v_profile record;
  v_pm record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Cart is empty';
  END IF;

  -- Load shipping config
  SELECT (value->>'charge')::numeric, (value->>'free_threshold')::numeric, (value->>'free_enabled')::boolean
    INTO v_shipping_charge, v_free_threshold, v_free_enabled
    FROM public.site_settings WHERE key = 'shipping';
  IF v_shipping_charge IS NULL THEN v_shipping_charge := 49; END IF;
  IF v_free_threshold IS NULL THEN v_free_threshold := 2500; END IF;
  IF v_free_enabled IS NULL THEN v_free_enabled := true; END IF;

  -- Load profile
  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile IS NULL THEN
    RAISE EXCEPTION 'Profile not found';
  END IF;

  -- Validate payment method if provided
  IF p_payment_method_id IS NOT NULL THEN
    SELECT * INTO v_pm FROM public.payment_methods WHERE id = p_payment_method_id AND enabled = true;
    IF v_pm IS NULL THEN
      RAISE EXCEPTION 'Invalid payment method';
    END IF;
  END IF;

  -- Generate order number: SL + YYMMDD + 4 random digits
  v_order_number := 'SL' || to_char(now(), 'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
  -- Ensure uniqueness (retry loop not needed for low volume; constraint guards)
  v_order_id := gen_random_uuid();

  -- Calculate subtotal from live DB prices
  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    v_qty := (v_item->>'quantity')::int;
    IF v_qty IS NULL OR v_qty <= 0 THEN
      RAISE EXCEPTION 'Invalid quantity';
    END IF;

    SELECT * INTO v_product FROM public.products WHERE id = (v_item->>'product_id')::uuid AND is_active = true;
    IF v_product IS NULL THEN
      RAISE EXCEPTION 'Product not available: %', v_item->>'product_id';
    END IF;

    v_price := v_product.price;
    v_orig := v_product.original_price;

    -- Variant override
    IF v_item ? 'variant_id' AND (v_item->>'variant_id') IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.product_variants WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id;
      IF v_variant IS NULL THEN
        RAISE EXCEPTION 'Invalid variant';
      END IF;
      IF v_variant.price_override IS NOT NULL THEN
        v_price := v_variant.price_override;
      END IF;
      IF v_variant.stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for variant of %', v_product.name;
      END IF;
      -- decrement variant stock
      UPDATE public.product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
    ELSE
      IF v_product.stock < v_qty THEN
        RAISE EXCEPTION 'Insufficient stock for %', v_product.name;
      END IF;
    END IF;

    -- Decrement product stock
    UPDATE public.products SET stock = stock - v_qty, sales_count = sales_count + v_qty WHERE id = v_product.id;

    -- Get first image
    SELECT url INTO v_img FROM public.product_images WHERE product_id = v_product.id ORDER BY display_order LIMIT 1;

    v_subtotal := v_subtotal + (v_price * v_qty);

    -- Insert order_item
    INSERT INTO public.order_items (order_id, product_id, product_name, product_image, variant_name, price, original_price, quantity)
    VALUES (
      v_order_id,
      v_product.id,
      v_product.name,
      v_img,
      CASE WHEN v_variant IS NOT NULL THEN v_variant.name || ': ' || v_variant.value ELSE NULL END,
      v_price,
      v_orig,
      v_qty
    );
  END LOOP;

  -- Coupon validation
  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons
      WHERE code = upper(p_coupon_code)
        AND is_active = true
        AND (expires_at IS NULL OR expires_at > now())
        AND (max_usage IS NULL OR usage_count < max_usage)
        AND min_order <= v_subtotal;
    IF v_coupon IS NULL THEN
      RAISE EXCEPTION 'Invalid or expired coupon';
    END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := LEAST((v_subtotal * v_coupon.discount_value / 100.0), v_subtotal);
    ELSE
      v_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;
    -- increment usage
    UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- Shipping
  IF v_free_enabled AND v_subtotal >= v_free_threshold THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_charge;
  END IF;

  v_total := v_subtotal - v_discount + v_shipping;
  IF v_total < 0 THEN v_total := 0; END IF;

  -- Insert order
  INSERT INTO public.orders (
    id, order_number, user_id, customer_name, email, mobile,
    address_line1, address_line2, city, state, pincode,
    subtotal, discount, shipping, total,
    coupon_code, payment_method_id, payment_method_name,
    payment_status, delivery_status
  ) VALUES (
    v_order_id, v_order_number, v_uid,
    COALESCE(p_address->>'full_name', v_profile.full_name, ''),
    v_profile.email,
    p_address->>'mobile',
    p_address->>'line1', p_address->>'line2', p_address->>'city', p_address->>'state', p_address->>'pincode',
    v_subtotal, v_discount, v_shipping, v_total,
    upper(p_coupon_code), p_payment_method_id, v_pm.name,
    'Pending', 'Pending'
  );

  -- Clear the user's cart
  DELETE FROM public.cart_items WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'subtotal', v_subtotal,
    'discount', v_discount,
    'shipping', v_shipping,
    'total', v_total
  );
END;
$$;

-- Grant execute to authenticated
GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb, text, uuid) TO authenticated;

-- ============================================================
-- submit_payment
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_payment(
  p_order_id uuid,
  p_payment_method_id uuid,
  p_payment_reference text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_order record;
  v_pm record;
  v_payment_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT * INTO v_order FROM public.orders WHERE id = p_order_id;
  IF v_order IS NULL THEN
    RAISE EXCEPTION 'Order not found';
  END IF;
  IF v_order.user_id <> v_uid THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  SELECT * INTO v_pm FROM public.payment_methods WHERE id = p_payment_method_id AND enabled = true;
  IF v_pm IS NULL THEN
    RAISE EXCEPTION 'Invalid payment method';
  END IF;

  v_payment_id := gen_random_uuid();
  INSERT INTO public.payments (id, order_id, user_id, payment_method_id, payment_method_name, amount, status, payment_reference, submitted_at)
  VALUES (v_payment_id, p_order_id, v_uid, p_payment_method_id, v_pm.name, v_order.total, 'Payment Submitted', p_payment_reference, now());

  -- Update order payment_status
  UPDATE public.orders SET payment_status = 'Payment Submitted', payment_method_id = p_payment_method_id, payment_method_name = v_pm.name
    WHERE id = p_order_id;

  -- History
  INSERT INTO public.payment_status_history (payment_id, previous_status, new_status, changed_by, note)
  VALUES (v_payment_id, 'Pending', 'Payment Submitted', v_uid, 'Customer submitted payment');

  RETURN jsonb_build_object('payment_id', v_payment_id, 'status', 'Payment Submitted');
END;
$$;

GRANT EXECUTE ON FUNCTION public.submit_payment(uuid, uuid, text) TO authenticated;

-- ============================================================
-- log_admin_action
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_admin_action(
  p_action text,
  p_target text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_details jsonb DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  INSERT INTO public.admin_audit_logs (admin_id, action, target, target_id, details)
  VALUES (auth.uid(), p_action, p_target, p_target_id, p_details);
END;
$$;

GRANT EXECUTE ON FUNCTION public.log_admin_action(text, text, text, jsonb) TO authenticated;

-- ============================================================
-- update_order_delivery_status (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_order_delivery_status(
  p_order_id uuid,
  p_new_status text,
  p_courier text DEFAULT NULL,
  p_tracking text DEFAULT NULL,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT delivery_status INTO v_old FROM public.orders WHERE id = p_order_id;
  UPDATE public.orders
    SET delivery_status = p_new_status,
        courier = COALESCE(p_courier, courier),
        tracking_number = COALESCE(p_tracking, tracking_number),
        delivery_notes = COALESCE(p_note, delivery_notes)
    WHERE id = p_order_id;
  INSERT INTO public.order_status_history (order_id, previous_status, new_status, changed_by, note)
  VALUES (p_order_id, v_old, p_new_status, v_uid, p_note);
  PERFORM public.log_admin_action('Order Status Changed', 'order', p_order_id::text, jsonb_build_object('from', v_old, 'to', p_new_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_order_delivery_status(uuid, text, text, text, text) TO authenticated;

-- ============================================================
-- update_payment_status (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION public.update_payment_status(
  p_payment_id uuid,
  p_new_status text,
  p_note text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old text;
  v_order_id uuid;
  v_uid uuid := auth.uid();
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT status, order_id INTO v_old, v_order_id FROM public.payments WHERE id = p_payment_id;
  UPDATE public.payments
    SET status = p_new_status,
        verified_at = CASE WHEN p_new_status IN ('Paid','Refunded','Failed') THEN now() ELSE verified_at END,
        verified_by = CASE WHEN p_new_status IN ('Paid','Refunded','Failed') THEN v_uid ELSE verified_by END
    WHERE id = p_payment_id;
  -- Sync order payment_status
  UPDATE public.orders SET payment_status = p_new_status WHERE id = v_order_id;
  INSERT INTO public.payment_status_history (payment_id, previous_status, new_status, changed_by, note)
  VALUES (p_payment_id, v_old, p_new_status, v_uid, p_note);
  PERFORM public.log_admin_action('Payment Status Changed', 'payment', p_payment_id::text, jsonb_build_object('from', v_old, 'to', p_new_status));
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_payment_status(uuid, text, text) TO authenticated;

-- ============================================================
-- Admin dashboard: revenue aggregate RPCs
-- Returns only paid-order revenue; admin-only.
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_revenue_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total numeric; v_today numeric; v_week numeric; v_month numeric; v_year numeric;
  v_paid_count int; v_total_orders int; v_pending int; v_aov numeric;
  v_refunds numeric;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;

  SELECT COALESCE(SUM(total),0) INTO v_total FROM public.orders WHERE payment_status = 'Paid';
  SELECT COALESCE(SUM(total),0) INTO v_today FROM public.orders WHERE payment_status = 'Paid' AND created_at::date = now()::date;
  SELECT COALESCE(SUM(total),0) INTO v_week FROM public.orders WHERE payment_status = 'Paid' AND created_at >= date_trunc('week', now());
  SELECT COALESCE(SUM(total),0) INTO v_month FROM public.orders WHERE payment_status = 'Paid' AND created_at >= date_trunc('month', now());
  SELECT COALESCE(SUM(total),0) INTO v_year FROM public.orders WHERE payment_status = 'Paid' AND created_at >= date_trunc('year', now());
  SELECT count(*) INTO v_paid_count FROM public.orders WHERE payment_status = 'Paid';
  SELECT count(*) INTO v_total_orders FROM public.orders;
  SELECT count(*) INTO v_pending FROM public.orders WHERE payment_status IN ('Pending','Payment Submitted','Under Verification');
  SELECT COALESCE(SUM(total),0) INTO v_refunds FROM public.orders WHERE payment_status = 'Refunded';
  v_aov := CASE WHEN v_paid_count > 0 THEN v_total / v_paid_count ELSE 0 END;

  RETURN jsonb_build_object(
    'total', v_total, 'today', v_today, 'week', v_week, 'month', v_month, 'year', v_year,
    'paid_orders', v_paid_count, 'total_orders', v_total_orders, 'pending_payments', v_pending,
    'aov', v_aov, 'refunds', v_refunds, 'net', v_total - v_refunds
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_summary() TO authenticated;

-- Revenue by day for a range (admin)
CREATE OR REPLACE FUNCTION public.admin_revenue_by_day(p_days int DEFAULT 7)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY day), '[]'::jsonb)
    FROM (
      SELECT d::date AS day,
             COALESCE(SUM(o.total), 0) AS revenue,
             count(o.id) AS orders
      FROM generate_series(date_trunc('day', now()) - (p_days - 1) * interval '1 day', date_trunc('day', now()), '1 day') d
      LEFT JOIN public.orders o ON o.created_at::date = d::date AND o.payment_status = 'Paid'
      GROUP BY d::date
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_by_day(int) TO authenticated;

-- Revenue by month for last N months (admin)
CREATE OR REPLACE FUNCTION public.admin_revenue_by_month(p_months int DEFAULT 12)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY month), '[]'::jsonb)
    FROM (
      SELECT to_char(d, 'YYYY-MM') AS month,
             to_char(d, 'Mon YYYY') AS label,
             COALESCE(SUM(o.total), 0) AS revenue,
             count(o.id) AS orders
      FROM generate_series(date_trunc('month', now()) - (p_months - 1) * interval '1 month', date_trunc('month', now()), '1 month') d
      LEFT JOIN public.orders o ON date_trunc('month', o.created_at) = d AND o.payment_status = 'Paid'
      GROUP BY d
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_by_month(int) TO authenticated;

-- Revenue by payment method (admin)
CREATE OR REPLACE FUNCTION public.admin_revenue_by_method()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY revenue DESC), '[]'::jsonb)
    FROM (
      SELECT COALESCE(o.payment_method_name, 'Unknown') AS method, SUM(o.total) AS revenue, count(*) AS orders
      FROM public.orders o WHERE o.payment_status = 'Paid'
      GROUP BY o.payment_method_name
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_by_method() TO authenticated;

-- Revenue by category (admin) — joins order_items to products->categories
CREATE OR REPLACE FUNCTION public.admin_revenue_by_category()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Permission denied'; END IF;
  RETURN (
    SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY revenue DESC), '[]'::jsonb)
    FROM (
      SELECT COALESCE(c.name, 'Uncategorized') AS category, SUM(oi.price * oi.quantity) AS revenue
      FROM public.order_items oi
      JOIN public.orders o ON o.id = oi.order_id AND o.payment_status = 'Paid'
      LEFT JOIN public.products p ON p.id = oi.product_id
      LEFT JOIN public.categories c ON c.id = p.category_id
      GROUP BY c.name
    ) t
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_revenue_by_category() TO authenticated;
