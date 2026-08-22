-- Keep the configured administrator and harden role management for multiple admins.
INSERT INTO public.user_roles (user_id, role)
VALUES ('ea9fdfdc-337e-473c-b7fd-1582226c969f', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;

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
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
    RAISE EXCEPTION 'Supabase user account not found';
  END IF;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (target_user_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END;
$$;

CREATE OR REPLACE FUNCTION public.remove_admin_role(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  admin_count integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;
  SELECT count(*) INTO admin_count FROM public.user_roles WHERE role = 'admin';
  IF admin_count <= 1 THEN
    RAISE EXCEPTION 'You cannot remove the last administrator';
  END IF;
  DELETE FROM public.user_roles WHERE user_id = target_user_id AND role = 'admin';
END;
$$;

REVOKE ALL ON FUNCTION public.set_admin_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_admin_role(uuid) TO authenticated;
REVOKE ALL ON FUNCTION public.remove_admin_role(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.remove_admin_role(uuid) TO authenticated;
