CREATE OR REPLACE FUNCTION public.list_admin_profiles()
RETURNS TABLE (
  user_id uuid,
  email text,
  full_name text,
  created_at timestamptz,
  is_active boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT roles.user_id, profiles.email, profiles.full_name, roles.created_at, profiles.is_active
  FROM public.user_roles AS roles
  JOIN public.profiles AS profiles ON profiles.id = roles.user_id
  WHERE roles.role = 'admin'
  ORDER BY roles.created_at ASC;
END;
$$;

CREATE OR REPLACE FUNCTION public.find_user_by_email(target_email text)
RETURNS TABLE (id uuid, email text, full_name text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Permission denied';
  END IF;

  RETURN QUERY
  SELECT profiles.id, profiles.email, profiles.full_name
  FROM public.profiles AS profiles
  WHERE lower(profiles.email) = lower(trim(target_email))
  LIMIT 1;
END;
$$;

REVOKE ALL ON FUNCTION public.list_admin_profiles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_admin_profiles() TO authenticated;
REVOKE ALL ON FUNCTION public.find_user_by_email(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_user_by_email(text) TO authenticated;