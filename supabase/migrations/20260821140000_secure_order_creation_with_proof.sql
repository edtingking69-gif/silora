-- Trusted order creation for QR proof orders. Prices, stock, discount, shipping,
-- amount matching, order items, payment, and cart clearing happen in one transaction.
CREATE OR REPLACE FUNCTION public.create_order_with_proof(
  p_items jsonb,
  p_address jsonb,
  p_coupon_code text DEFAULT NULL,
  p_payment_method_id uuid DEFAULT NULL,
  p_payment_proof_path text DEFAULT NULL,
  p_payment_amount numeric DEFAULT NULL,
  p_order_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_order_id uuid := COALESCE(p_order_id, gen_random_uuid());
  v_order_number text := 'SL' || to_char(now(), 'YYMMDD') || lpad(floor(random() * 10000)::text, 4, '0');
  v_profile record;
  v_pm record;
  v_item jsonb;
  v_product record;
  v_variant record;
  v_qty integer;
  v_price numeric(12,2);
  v_original_price numeric(12,2);
  v_subtotal numeric(12,2) := 0;
  v_discount numeric(12,2) := 0;
  v_total numeric(12,2) := 0;
  v_coupon record;
  v_image text;
  v_payment_status text := 'Pending';
  v_delivery_status text := 'pending';
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  IF p_items IS NULL OR jsonb_array_length(p_items) = 0 THEN RAISE EXCEPTION 'Cart is empty'; END IF;
  PERFORM set_config('silora.order_creation', 'trusted_rpc', true);

  CREATE TEMP TABLE _verified_order_items (
    product_id uuid,
    product_name text,
    product_image text,
    variant_name text,
    price numeric(12,2),
    original_price numeric(12,2),
    quantity integer
  ) ON COMMIT DROP;

  SELECT * INTO v_profile FROM public.profiles WHERE id = v_uid;
  IF v_profile IS NULL THEN RAISE EXCEPTION 'Customer profile not found'; END IF;

  SELECT * INTO v_pm FROM public.payment_methods
  WHERE id = p_payment_method_id AND enabled = true;
  IF v_pm IS NULL OR v_pm.type = 'cod' THEN RAISE EXCEPTION 'Invalid payment method'; END IF;

  IF v_pm.type = 'upi_qr' THEN
    IF p_payment_proof_path IS NULL
      OR split_part(p_payment_proof_path, '/', 1) <> v_uid::text
      OR split_part(p_payment_proof_path, '/', 2) <> v_order_id::text
      OR split_part(p_payment_proof_path, '/', 3) = ''
      OR split_part(p_payment_proof_path, '/', 4) <> '' THEN
      RAISE EXCEPTION 'Payment proof is required';
    END IF;
  END IF;

  FOR v_item IN SELECT jsonb_array_elements(p_items) LOOP
    v_variant := NULL;
    v_qty := (v_item->>'quantity')::integer;
    IF v_qty IS NULL OR v_qty <= 0 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;

    SELECT * INTO v_product FROM public.products
    WHERE id = (v_item->>'product_id')::uuid AND is_active = true FOR UPDATE;
    IF v_product IS NULL THEN RAISE EXCEPTION 'Product is no longer available'; END IF;
    IF v_product.stock < v_qty THEN RAISE EXCEPTION 'Insufficient stock for %', v_product.name; END IF;

    v_price := v_product.price;
    v_original_price := v_product.original_price;
    IF v_item ? 'variant_id' AND NULLIF(v_item->>'variant_id', '') IS NOT NULL THEN
      SELECT * INTO v_variant FROM public.product_variants
      WHERE id = (v_item->>'variant_id')::uuid AND product_id = v_product.id FOR UPDATE;
      IF v_variant IS NULL OR v_variant.stock < v_qty THEN RAISE EXCEPTION 'Insufficient variant stock'; END IF;
      IF v_variant.price_override IS NOT NULL THEN v_price := v_variant.price_override; END IF;
      UPDATE public.product_variants SET stock = stock - v_qty WHERE id = v_variant.id;
    END IF;

    UPDATE public.products
    SET stock = stock - v_qty, sales_count = sales_count + v_qty
    WHERE id = v_product.id;
    SELECT url INTO v_image FROM public.product_images
    WHERE product_id = v_product.id ORDER BY display_order LIMIT 1;

    v_subtotal := v_subtotal + (v_price * v_qty);
    INSERT INTO _verified_order_items (product_id, product_name, product_image, variant_name, price, original_price, quantity)
    VALUES (
      v_product.id,
      v_product.name,
      v_image,
      CASE WHEN v_variant IS NULL THEN NULL ELSE v_variant.name || ': ' || v_variant.value END,
      v_price,
      v_original_price,
      v_qty
    );
  END LOOP;

  IF p_coupon_code IS NOT NULL AND p_coupon_code <> '' THEN
    SELECT * INTO v_coupon FROM public.coupons
    WHERE code = upper(p_coupon_code) AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND (max_usage IS NULL OR usage_count < max_usage)
      AND min_order <= v_subtotal;
    IF v_coupon IS NULL THEN RAISE EXCEPTION 'Invalid or expired coupon'; END IF;
    IF v_coupon.discount_type = 'percentage' THEN
      v_discount := LEAST(v_subtotal * v_coupon.discount_value / 100.0, v_subtotal);
    ELSE
      v_discount := LEAST(v_coupon.discount_value, v_subtotal);
    END IF;
    UPDATE public.coupons SET usage_count = usage_count + 1 WHERE id = v_coupon.id;
  END IF;

  v_total := GREATEST(0, v_subtotal - v_discount);
  IF v_pm.type = 'upi_qr' THEN
    IF p_payment_amount IS NULL OR round(p_payment_amount * 100) <> round(v_total * 100) THEN
      RAISE EXCEPTION 'Payment amount does not match the order total';
    END IF;
    v_payment_status := 'pending_verification';
  END IF;

  INSERT INTO public.orders (
    id, order_number, user_id, customer_name, email, mobile,
    address_line1, address_line2, city, state, pincode,
    subtotal, discount, shipping, total, amount_paid,
    coupon_code, payment_method_id, payment_method_name, payment_proof_path,
    payment_status, delivery_status
  ) VALUES (
    v_order_id, v_order_number, v_uid,
    COALESCE(p_address->>'full_name', v_profile.full_name, ''),
    v_profile.email,
    p_address->>'mobile',
    p_address->>'line1', p_address->>'line2', p_address->>'city', p_address->>'state', p_address->>'pincode',
    v_subtotal, v_discount, 0, v_total,
    CASE WHEN v_pm.type = 'upi_qr' THEN p_payment_amount ELSE NULL END,
    NULLIF(upper(p_coupon_code), ''), p_payment_method_id, v_pm.name, p_payment_proof_path,
    v_payment_status, v_delivery_status
  );

  INSERT INTO public.order_items (order_id, product_id, product_name, product_image, variant_name, price, original_price, quantity)
  SELECT v_order_id, product_id, product_name, product_image, variant_name, price, original_price, quantity
  FROM _verified_order_items;

  INSERT INTO public.payments (
    order_id, user_id, payment_method_id, payment_method_name, amount, status
  ) VALUES (
    v_order_id, v_uid, p_payment_method_id, v_pm.name,
    v_total, v_payment_status
  );

  DELETE FROM public.cart_items WHERE user_id = v_uid;

  RETURN jsonb_build_object(
    'order_id', v_order_id,
    'order_number', v_order_number,
    'total', v_total,
    'payment_method_name', v_pm.name,
    'payment_status', v_payment_status,
    'delivery_status', v_delivery_status
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_order_with_proof(jsonb, jsonb, text, uuid, text, numeric, uuid) TO authenticated;
