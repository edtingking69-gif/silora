# Initial administrator setup

This project does not contain Supabase service-role credentials, so the initial Auth account must be created in the Supabase Dashboard. Do not put the password in this repository, a migration, or an environment file.

## Create or confirm the Auth account

1. Open the linked Supabase project in the Supabase Dashboard.
2. Go to **Authentication > Users**.
3. Create the user with the requested administrator email and password. Enable **Auto Confirm User** or confirm the account after creation.
4. If the email already exists, do not create another user. Confirm the existing account and keep its current password unless it needs to be reset in the Dashboard.

Enter the password only in the Dashboard form. It is intentionally omitted from this document.

## Assign the admin role

Run this in the Supabase SQL Editor after the Auth account exists:

```sql
DO $$
DECLARE
  admin_id uuid;
BEGIN
  SELECT id INTO admin_id
  FROM auth.users
  WHERE lower(email) = lower('allaloke697@gmail.com')
  LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'The Auth user must be created before assigning the admin role';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (admin_id, 'admin')
  ON CONFLICT (user_id, role) DO NOTHING;
END
$$;
```

The statement is idempotent: it does not create a duplicate Auth user or duplicate role.

## Verify

```sql
SELECT u.id, u.email, u.email_confirmed_at, r.role
FROM auth.users AS u
JOIN public.user_roles AS r ON r.user_id = u.id
WHERE lower(u.email) = lower('allaloke697@gmail.com')
  AND r.role = 'admin';
```

Then sign in through the existing Admin Login page and confirm that the Admin Dashboard opens. A customer account must not be able to open the dashboard because route access and database operations remain protected by the existing authentication and RLS checks.
