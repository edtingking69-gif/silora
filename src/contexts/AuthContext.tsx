async function loadProfile(userId: string) {
  try {
    const { data: prof, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      console.error('Profile loading error:', profileError);
    }

    setProfile(prof as Profile | null);

    const { data: roles, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (roleError) {
      console.error('Role loading error:', roleError);
      setRole('customer');
      return;
    }

    const hasAdminRole = (roles ?? []).some(
      (r) => r.role === 'admin' || r.role === 'super_admin'
    );

    setRole(hasAdminRole ? 'admin' : 'customer');
  } catch (error) {
    console.error('Error loading user profile:', error);
    setProfile(null);
    setRole('customer');
  }
}