-- Final checkout security repair.
-- Keep orders and payment proofs private while allowing the authenticated checkout RPC.

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_path text;
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('Pending', 'pending', 'pending_verification', 'Payment Submitted', 'Under Verification', 'Paid', 'paid', 'rejected', 'Failed', 'Refunded', 'Cancelled')
);

DROP POLICY IF EXISTS "orders_select_own_or_admin" ON public.orders;
CREATE POLICY "orders_select_own_or_admin" ON public.orders
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_admin());

DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "orders_admin_update" ON public.orders;
CREATE POLICY "orders_admin_update" ON public.orders
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

-- Direct customer inserts cannot choose totals or paid status. The checkout uses
-- create_order_with_proof, which sets this transaction-local marker after auth and
-- trusted product/stock/amount validation.
CREATE OR REPLACE FUNCTION public.enforce_trusted_order_creation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF current_setting('silora.order_creation', true) <> 'trusted_rpc' THEN
    RAISE EXCEPTION 'Orders must be created through the trusted checkout flow';
  END IF;
  IF NEW.user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Order user must match the authenticated user';
  END IF;
  IF NEW.payment_status IN ('Paid', 'paid') THEN
    RAISE EXCEPTION 'Customer orders cannot be created as paid';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS orders_require_trusted_creation ON public.orders;
CREATE TRIGGER orders_require_trusted_creation
  BEFORE INSERT ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_trusted_order_creation();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs', 'payment-proofs', false, 5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = 'payment-proofs',
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[];

-- Remove any legacy policies that could broaden access to this bucket.
DROP POLICY IF EXISTS "storage_public_read" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_write" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_update" ON storage.objects;
DROP POLICY IF EXISTS "storage_admin_delete" ON storage.objects;

DROP POLICY IF EXISTS "payment_proofs_insert_own" ON storage.objects;
CREATE POLICY "payment_proofs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(storage.foldername(name), 1) = 3
  );

DROP POLICY IF EXISTS "payment_proofs_select_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );

DROP POLICY IF EXISTS "payment_proofs_update_own" ON storage.objects;
CREATE POLICY "payment_proofs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = auth.uid()::text);

DROP POLICY IF EXISTS "payment_proofs_delete_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = auth.uid()::text OR public.is_admin())
  );
