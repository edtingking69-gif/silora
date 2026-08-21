import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/utils/format';
import { UserCog, Plus, Trash2, ShieldCheck, Mail } from 'lucide-react';

interface AdminUser {
  user_id: string;
  role: string;
  email: string;
  full_name: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

export function AdminAdmins() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [invitePassword, setInvitePassword] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviting, setInviting] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    // Get admin roles joined with profiles
    const { data: roles } = await supabase.from('user_roles').select('user_id, role, created_at').eq('role', 'admin');
    if (!roles) { setLoading(false); return; }
    const userIds = roles.map((r) => r.user_id);
    const { data: profiles } = await supabase.from('profiles').select('id, email, full_name').in('id', userIds);
    // Get last sign-in from auth (not directly queryable, so we use profiles created_at)
    const adminUsers: AdminUser[] = (roles as { user_id: string; role: string; created_at: string }[]).map((r) => {
      const prof = (profiles as { id: string; email: string; full_name: string | null }[] | null)?.find((p) => p.id === r.user_id);
      return {
        user_id: r.user_id,
        role: r.role,
        email: prof?.email ?? 'Unknown',
        full_name: prof?.full_name ?? null,
        created_at: r.created_at,
        last_sign_in_at: null,
      };
    });
    setAdmins(adminUsers);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleInvite() {
    if (!inviteEmail || !invitePassword) { toast('Email and password are required', 'error'); return; }
    if (invitePassword.length < 6) { toast('Password must be at least 6 characters', 'error'); return; }
    setInviting(true);
    try {
      // Create the user via admin invite
      const { data, error } = await supabase.auth.admin.createUser({
        email: inviteEmail,
        password: invitePassword,
        user_metadata: { full_name: inviteName },
        email_confirm: true,
      });
      if (error) {
        // If admin.createUser not available (anon key), try signUp + then set role
        // Fallback: sign up normally, then set admin role via RPC
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: inviteEmail,
          password: invitePassword,
          options: { data: { full_name: inviteName } },
        });
        if (signUpError) throw signUpError;
        if (signUpData.user) {
          const { error: roleError } = await supabase.rpc('set_admin_role', { target_user_id: signUpData.user.id });
          if (roleError) throw roleError;
        }
      } else if (data.user) {
        const { error: roleError } = await supabase.rpc('set_admin_role', { target_user_id: data.user.id });
        if (roleError) throw roleError;
      }
      await supabase.rpc('log_admin_action', { p_action: 'Admin Added', p_target: 'user', p_target_id: null, p_details: { email: inviteEmail } });
      toast('Admin invited successfully');
      setShowInvite(false);
      setInviteEmail(''); setInvitePassword(''); setInviteName('');
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to invite admin', 'error');
    } finally {
      setInviting(false);
    }
  }

  async function handleRemove() {
    if (!removeId) return;
    try {
      const { error } = await supabase.rpc('remove_admin_role', { target_user_id: removeId });
      if (error) throw error;
      await supabase.rpc('log_admin_action', { p_action: 'Admin Removed', p_target: 'user', p_target_id: removeId });
      toast('Admin removed');
      setRemoveId(null);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Failed to remove admin', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Administrators ({admins.length})</h1>
        <Button onClick={() => setShowInvite(true)} size="sm"><Plus className="h-4 w-4" /> Invite Admin</Button>
      </div>

      <div className="rounded-xl bg-accent-50 p-3 text-xs text-accent-700 flex items-start gap-2">
        <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" />
        <p>Only existing admins can invite or remove administrators. The last admin cannot remove themselves. Users cannot self-assign the admin role.</p>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : admins.length === 0 ? (
        <EmptyState icon={<UserCog className="h-8 w-8" />} title="No admins" message="Invite an administrator." />
      ) : (
        <div className="space-y-2">
          {admins.map((a) => (
            <div key={a.user_id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                {(a.full_name ?? a.email ?? 'A').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{a.full_name || 'Admin'}</p>
                <p className="flex items-center gap-1 text-xs text-ink-500 truncate"><Mail className="h-3 w-3" /> {a.email}</p>
                <p className="text-xs text-ink-400">Added: {formatDate(a.created_at)}</p>
              </div>
              <Badge variant="primary">Admin</Badge>
              {a.user_id !== currentUser?.id && (
                <button onClick={() => setRemoveId(a.user_id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={showInvite} onClose={() => setShowInvite(false)} title="Invite Administrator">
        <div className="space-y-4">
          <div className="rounded-xl bg-warning-50 p-3 text-xs text-warning-700">
            The invited person will receive an account with admin privileges. They can sign in using the email and password you set. You do not need to enter their password — set a temporary password they can change later.
          </div>
          <Input label="Full Name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
          <Input label="Email *" type="email" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Input label="Temporary Password *" type="password" value={invitePassword} onChange={(e) => setInvitePassword(e.target.value)} placeholder="Min 6 characters" />
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowInvite(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleInvite} loading={inviting} className="flex-1">Invite Admin</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!removeId} onClose={() => setRemoveId(null)} onConfirm={handleRemove} title="Remove Admin" message="This will remove admin privileges from this user. Their customer account will remain." confirmLabel="Remove" danger />
    </div>
  );
}
