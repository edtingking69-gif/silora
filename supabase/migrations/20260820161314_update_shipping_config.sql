/*
# Update shipping configuration to free shipping on all orders

## Changes
- Updates `site_settings` row for key 'shipping' with new JSONB structure:
  {"enabled":true,"shipping_fee":0,"free_shipping_threshold":0,"message":"Free shipping on all orders"}
- Updates the `create_order` RPC to read the new field names (`shipping_fee`, `free_shipping_threshold`, `enabled`)
  instead of the old names (`charge`, `free_threshold`, `free_enabled`).
- With shipping_fee=0, all orders will have shipping=₹0 regardless of subtotal.

## Important
- No tables are created or dropped.
- No data is lost — only the shipping config value is updated.
- The create_order function is replaced to use the new field names.
*/

-- Update the shipping config
UPDATE public.site_settings
SET value = '{"enabled":true,"shipping_fee":0,"free_shipping_threshold":0,"message":"Free shipping on all orders"}'::jsonb,
    updated_at = now()
WHERE key = 'shipping';

-- If the row doesn't exist, insert it
INSERT INTO public.site_settings (key, value)
SELECT 'shipping', '{"enabled":true,"shipping_fee":0,"free_shipping_threshold":0,"message":"Free shipping on all orders"}'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM public.site_settings WHERE key = 'shipping');

-- ============================================================
-- Updated create_order RPC — reads new shipping config field names
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
  v_shipping_fee numeric;
  v_free_threshold numeric;
  v_enabled boolean;
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

  -- Load shipping config (new field names: shipping_fee, free_shipping_threshold, enabled)
  SELECT
    COALESCE((value->>'shipping_fee')::numeric, (value->>'charge')::numeric, 0),
    COALESCE((value->>'free_shipping_threshold')::numeric, (value->>'free_threshold')::numeric, 0),
    COALESCE((value->>'enabled')::boolean, (value->>'free_enabled')::boolean, true)
    INTO v_shipping_fee, v_free_threshold, v_enabled
    FROM public.site_settings WHERE key = 'shipping';

  IF v_shipping_fee IS NULL THEN v_shipping_fee := 0; END IF;
  IF v_free_threshold IS NULL THEN v_free_threshold := 0; END IF;
  IF v_enabled IS NULL THEN v_enabled := true; END IF;

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

  -- Generate order number
  v_order_number := 'SL' || to_char(now(), 'YYMMDD') || lpad(floor(random()*10000)::text, 4, '0');
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
    UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  -- Shipping: if enabled and (threshold is 0 or subtotal >= threshold), shipping is free
  -- With shipping_fee=0, shipping is always 0 regardless
  IF v_enabled AND (v_free_threshold = 0 OR v_subtotal >= v_free_threshold) THEN
    v_shipping := 0;
  ELSE
    v_shipping := v_shipping_fee;
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

GRANT EXECUTE ON FUNCTION public.create_order(jsonb, jsonb, text, uuid) TO authenticated;
