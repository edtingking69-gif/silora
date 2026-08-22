import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { status: 204, headers: corsHeaders });
  if (request.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405);

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return jsonResponse({ error: 'Please sign in as an administrator.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      console.error('create-admin: required server-side Supabase secret is missing');
      return jsonResponse({ error: 'Administrator service is not configured.' }, 500);
    }

    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: { user: caller }, error: callerError } = await callerClient.auth.getUser();
    if (callerError || !caller) return jsonResponse({ error: 'Please sign in as an administrator.' }, 401);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: callerRole, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', caller.id)
      .eq('role', 'admin')
      .maybeSingle();
    if (roleError) {
      console.error('create-admin: role check failed', roleError.message);
      return jsonResponse({ error: 'Unable to verify administrator permissions.' }, 500);
    }
    if (!callerRole) return jsonResponse({ error: 'You do not have permission to add administrators.' }, 403);

    const body = await request.json() as { name?: string; email?: string; password?: string };
    const name = body.name?.trim();
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    if (!name) return jsonResponse({ error: 'Name is required.' }, 400);
    if (!email || !email.includes('@')) return jsonResponse({ error: 'A valid email is required.' }, 400);
    if (!password) return jsonResponse({ error: 'Password is required.' }, 400);
    if (password.length < 8) return jsonResponse({ error: 'Password must contain at least 8 characters.' }, 400);

    const { data: users, error: usersError } = await adminClient.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (usersError) {
      console.error('create-admin: Auth user lookup failed', usersError.message);
      return jsonResponse({ error: 'Unable to check the existing account.' }, 500);
    }
    const existingUser = users.users.find((user) => user.email?.toLowerCase() === email);
    if (existingUser) {
      const { data: existingAdmin, error: existingRoleError } = await adminClient
        .from('user_roles')
        .select('role')
        .eq('user_id', existingUser.id)
        .eq('role', 'admin')
        .maybeSingle();
      if (existingRoleError) {
        console.error('create-admin: existing role lookup failed', existingRoleError.message);
        return jsonResponse({ error: 'Unable to check existing administrator access.' }, 500);
      }
      if (existingAdmin) return jsonResponse({ error: 'This user is already an administrator.', already_admin: true }, 409);

      const { error: promoteError } = await adminClient
        .from('user_roles')
        .upsert({ user_id: existingUser.id, role: 'admin' }, { onConflict: 'user_id,role' });
      if (promoteError) {
        console.error('create-admin: existing user role assignment failed', promoteError.message);
        return jsonResponse({ error: 'Unable to assign the administrator role.' }, 500);
      }
      return jsonResponse({ created: false, assigned: true });
    }

    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name },
    });
    if (createError || !created.user) {
      console.error('create-admin: Auth user creation failed', createError?.message ?? 'No user returned');
      return jsonResponse({ error: 'Unable to create the administrator Auth account.' }, 400);
    }

    const { error: roleInsertError } = await adminClient
      .from('user_roles')
      .upsert({ user_id: created.user.id, role: 'admin' }, { onConflict: 'user_id,role' });
    if (roleInsertError) {
      const { error: rollbackError } = await adminClient.auth.admin.deleteUser(created.user.id);
      if (rollbackError) console.error('create-admin: rollback failed', rollbackError.message);
      console.error('create-admin: role assignment failed', roleInsertError.message);
      return jsonResponse({ error: 'Unable to assign the administrator role. The Auth account was rolled back.' }, 500);
    }

    return jsonResponse({ created: true });
  } catch (error) {
    console.error('create-admin: unexpected failure', error instanceof Error ? error.message : error);
    return jsonResponse({ error: 'Unable to create administrator. Please try again.' }, 500);
  }
});
