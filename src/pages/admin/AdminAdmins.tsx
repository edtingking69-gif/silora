import { useEffect, useState } from 'react';
import { Mail, Plus, ShieldCheck, Trash2, UserCog } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatDate } from '@/utils/format';

interface AdminUser {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  is_active: boolean;
}

interface AdminLookupRow {
  id: string;
  email: string;
  full_name: string | null;
}

export function AdminAdmins() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [email, setEmail] = useState('');
  const [saving, setSaving] = useState(false);
  const [removeId, setRemoveId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data, error } = await supabase.rpc('list_admin_profiles');
    if (error) {
      toast(error.message, 'error');
      setLoading(false);
      return;
    }
    setAdmins((data ?? []) as AdminUser[]);
    setLoading(false);
  }

  useEffect(() => { void load(); }, []);

  function closeAdd() {
    setShowAdd(false);
    setEmail('');
  }

  async function handleAdd() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      toast('Email is required', 'error');
      return;
    }
    setSaving(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        toast('Please sign in as an administrator.', 'error');
        return;
      }
      const { data: matches, error } = await supabase.rpc('find_user_by_email', { target_email: normalizedEmail });
      if (error) {
        throw error;
      }
      const target = (matches as AdminLookupRow[] | null)?.[0];
      if (!target) {
        toast('No existing Supabase user was found for this email. Ask them to sign up first.', 'error');
        return;
      }
      const { error: roleError } = await supabase.rpc('set_admin_role', { target_user_id: target.id });
      if (roleError) throw roleError;
      toast('Administrator access granted');
      await supabase.rpc('log_admin_action', { p_action: 'Admin Added', p_target: 'user', p_details: { email: normalizedEmail } });
      closeAdd();
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Admin creation failed: Unknown error', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleRemove() {
    if (!removeId || admins.length <= 1) return;
    try {
      const { error } = await supabase.rpc('remove_admin_role', { target_user_id: removeId });
      if (error) throw error;
      await supabase.rpc('log_admin_action', { p_action: 'Admin Removed', p_target: 'user', p_target_id: removeId });
      toast('Administrator access removed');
      setRemoveId(null);
      await load();
    } catch (error) {
      toast(error instanceof Error ? error.message : 'Failed to remove administrator', 'error');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Administrators ({admins.length})</h1>
        <Button onClick={() => setShowAdd(true)} size="sm"><Plus className="h-4 w-4" /> Add Admin</Button>
      </div>
      <div className="flex items-start gap-2 rounded-xl bg-accent-50 p-3 text-xs text-accent-700">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
        <p>Admins use their own Supabase Auth account. Existing users are promoted securely; new users receive an account with the password supplied through the protected administrator service.</p>
      </div>

      {loading ? <div className="space-y-2">{[1, 2].map((item) => <div key={item} className="h-20 animate-shimmer rounded-2xl bg-ink-100" />)}</div> : admins.length === 0 ? (
        <EmptyState icon={<UserCog className="h-8 w-8" />} title="No administrators" message="The configured administrator role could not be found." />
      ) : (
        <div className="space-y-2">
          {admins.map((admin) => {
            const isLastAdmin = admins.length === 1;
            const isCurrentAdmin = admin.user_id === currentUser?.id;
            return (
              <div key={admin.user_id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">{(admin.full_name ?? admin.email).charAt(0).toUpperCase()}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-ink-900">{admin.full_name || 'Administrator'}</p>
                  <p className="flex items-center gap-1 truncate text-xs text-ink-500"><Mail className="h-3 w-3" /> {admin.email}</p>
                  <p className="text-xs text-ink-400">Added {formatDate(admin.created_at)}</p>
                </div>
                <Badge variant="primary">Admin</Badge>
                <Badge variant={admin.is_active ? 'success' : 'default'}>{admin.is_active ? 'Active' : 'Inactive'}</Badge>
                <button
                  type="button"
                  onClick={() => setRemoveId(admin.user_id)}
                  disabled={isLastAdmin || isCurrentAdmin}
                  title={isLastAdmin ? 'You cannot remove the last administrator.' : isCurrentAdmin ? 'You cannot remove your own administrator access.' : 'Remove Admin'}
                  className="rounded-lg p-2 text-error-500 hover:bg-error-50 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`Remove admin ${admin.email}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
                {isLastAdmin && <p className="basis-full text-xs text-warning-700">You cannot remove the last administrator.</p>}
              </div>
            );
          })}
        </div>
      )}

      <Modal open={showAdd} onClose={closeAdd} title="Add Admin">
        <div className="space-y-4">
          <p className="rounded-xl bg-ink-50 p-3 text-xs leading-5 text-ink-600">Enter the email of an existing Supabase user. They must sign up first; administrator access is then granted securely by the database.</p>
          <Input label="Email *" type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          <div className="flex gap-3 pt-2"><Button variant="outline" onClick={closeAdd} className="flex-1">Cancel</Button><Button onClick={handleAdd} loading={saving} className="flex-1">Add Admin</Button></div>
        </div>
      </Modal>
      <ConfirmDialog open={!!removeId} onClose={() => setRemoveId(null)} onConfirm={handleRemove} title="Remove Admin" message="Are you sure you want to remove administrator access from this user? Their customer account, profile, and orders will remain." confirmLabel="Remove Admin" danger />
    </div>
  );
}
