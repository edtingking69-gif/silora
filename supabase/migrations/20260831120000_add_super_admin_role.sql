-- Migration: add super_admin role support and seed Super Admin
-- Adds a lightweight extra roles table to avoid changing the original role CHECK constraints,
-- provides is_super_admin(), updates is_admin(), adds get_user_role(), and seeds the initial Super Admin.

BEGIN;

-- Extra roles table (no restrictive CHECK so new roles can be introduced safely)
CREATE TABLE IF NOT EXISTS public.user_roles_extra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles_extra ENABLE ROW LEVEL SECURITY;

-- SECURITY: only allow selects on extra roles to admins (via is_admin)
DROP POLICY IF EXISTS "user_roles_extra_select_admin" ON public.user_roles_extra;
CREATE POLICY "user_roles_extra_select_admin" ON public.user_roles_extra FOR SELECT
  TO authenticated USING (public.is_admin());

-- Helper: is_super_admin
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles_extra
    WHERE user_id = auth.uid() AND role = 'super_admin'
  );
$$;

-- Update is_admin to include admins from user_roles OR super_admins from user_roles_extra
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM (
      SELECT role, user_id FROM public.user_roles
      UNION ALL
      SELECT role, user_id FROM public.user_roles_extra
    ) x
    WHERE x.user_id = auth.uid() AND x.role IN ('admin','super_admin')
  );
$$;

-- Public helper: get_user_role returns a single role string for frontend convenience
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  _found boolean;
BEGIN
  IF uid IS NULL THEN
    RETURN 'customer';
  END IF;
  -- Super admin takes precedence
  SELECT true INTO _found FROM public.user_roles_extra WHERE user_id = uid AND role = 'super_admin' LIMIT 1;
  IF FOUND THEN
    RETURN 'super_admin';
  END IF;
  -- Admin
  SELECT true INTO _found FROM public.user_roles WHERE user_id = uid AND role = 'admin' LIMIT 1;
  IF FOUND THEN
    RETURN 'admin';
  END IF;
  RETURN 'customer';
END;
$$;

-- Restrict existing admin management RPCs: only super_admin can promote/demote other admins
CREATE OR REPLACE FUNCTION public.set_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
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
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'Cannot remove the last administrator';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin';
END;
$$;

-- Seed the Super Admin role for the provided email (if profile exists)
INSERT INTO public.user_roles_extra (user_id, role)
SELECT p.id, 'super_admin'
FROM public.profiles p
WHERE lower(p.email) = lower('allaloke697@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;

COMMIT;
