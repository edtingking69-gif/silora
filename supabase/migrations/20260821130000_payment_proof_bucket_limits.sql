-- Ensure the existing payment-proofs bucket is private and restricted to image proofs.
ALTER TABLE public.orders ADD COLUMN IF NOT EXISTS amount_paid numeric(12,2);

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'payment-proofs',
  'payment-proofs',
  false,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  public = false,
  file_size_limit = 5242880,
  allowed_mime_types = EXCLUDED.allowed_mime_types;