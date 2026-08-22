-- Allow authenticated customers to create only their own order records.
DROP POLICY IF EXISTS "orders_insert_own" ON public.orders;
CREATE POLICY "orders_insert_own" ON public.orders
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- The current client order path inserts line items and the initial payment after the order.
DROP POLICY IF EXISTS "order_items_insert_own_or_admin" ON public.order_items;
CREATE POLICY "order_items_insert_own_or_admin" ON public.order_items
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_items.order_id
        AND (o.user_id = auth.uid() OR public.is_admin())
    )
  );

DROP POLICY IF EXISTS "payments_insert_own_or_admin" ON public.payments;
CREATE POLICY "payments_insert_own_or_admin" ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR public.is_admin());

-- Payment proof references are stored on orders; the image stays in private Storage.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS payment_proof_path text;

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_status_check CHECK (
  payment_status IN ('Pending','pending','pending_verification','Payment Submitted','Under Verification','Paid','paid','rejected','Failed','Refunded','Cancelled')
);

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_delivery_status_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_delivery_status_check CHECK (
  delivery_status IN ('Pending','pending','Confirmed','Processing','Packed','Shipped','Out for Delivery','Delivered','Cancelled','Returned')
);

ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_status_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_status_check CHECK (
  status IN ('Pending','pending','pending_verification','Payment Submitted','Under Verification','Paid','paid','rejected','Failed','Refunded','Cancelled')
);

-- Private payment-proof bucket. The object path must begin with the authenticated user's ID.
INSERT INTO storage.buckets (id, name, public)
VALUES ('payment-proofs', 'payment-proofs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "payment_proofs_insert_own" ON storage.objects;
CREATE POLICY "payment_proofs_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'payment-proofs'
    AND (storage.foldername(name))[1] = (select auth.uid()::text)
  );

DROP POLICY IF EXISTS "payment_proofs_select_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_select_own_or_admin" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND (
      (storage.foldername(name))[1] = (select auth.uid()::text)
      OR public.is_admin()
    )
  );

DROP POLICY IF EXISTS "payment_proofs_update_own" ON storage.objects;
CREATE POLICY "payment_proofs_update_own" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = (select auth.uid()::text))
  WITH CHECK (bucket_id = 'payment-proofs' AND (storage.foldername(name))[1] = (select auth.uid()::text));

DROP POLICY IF EXISTS "payment_proofs_delete_own_or_admin" ON storage.objects;
CREATE POLICY "payment_proofs_delete_own_or_admin" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'payment-proofs'
    AND ((storage.foldername(name))[1] = (select auth.uid()::text) OR public.is_admin())
  );
