import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminProfiles, fetchUserAddresses } from '@/services/api';
import type { Profile, Address, Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, formatDate, classNames } from '@/utils/format';
import { Users, Search, Mail, Phone, MapPin, Package, Trash2, Eye } from 'lucide-react';

export function AdminCustomers() {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<{ profile: Profile; addresses: Address[]; orders: Order[]; totalPaid: number } | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const p = await fetchAdminProfiles();
    setProfiles(p);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openCustomer(profile: Profile) {
    const [addresses, ordersData] = await Promise.all([
      fetchUserAddresses(profile.id),
      supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }),
    ]);
    const orders = (ordersData.data as Order[]) ?? [];
    const totalPaid = orders.filter((o) => o.payment_status === 'Paid').reduce((sum, o) => sum + Number(o.total), 0);
    setSelected({ profile, addresses, orders, totalPaid });
  }

  async function handleDelete() {
    if (!deleteId) return;
    // Anonymize profile instead of hard delete to preserve order history
    const { error } = await supabase.from('profiles').update({
      full_name: 'Deleted Customer',
      mobile: null,
      is_active: false,
      email: `deleted-${deleteId.slice(0, 8)}@silora.in`,
    }).eq('id', deleteId);
    if (error) { toast(error.message, 'error'); return; }
    await supabase.rpc('log_admin_action', { p_action: 'Customer Deleted', p_target: 'customer', p_target_id: deleteId });
    toast('Customer account deactivated and anonymized');
    setDeleteId(null);
    load();
  }

  const filtered = profiles.filter((p) =>
    p.email.toLowerCase().includes(search.toLowerCase()) ||
    (p.full_name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (p.mobile ?? '').includes(search)
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Customers ({profiles.length})</h1>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name, email, mobile..." className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Users className="h-8 w-8" />} title="No customers" message="Customer accounts will appear here." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
                {(p.full_name ?? p.email ?? 'U').charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{p.full_name || 'Unknown'}</p>
                <p className="text-xs text-ink-500 truncate">{p.email}</p>
                {p.mobile && <p className="text-xs text-ink-500 flex items-center gap-1"><Phone className="h-3 w-3" />{p.mobile}</p>}
              </div>
              <div className="text-right">
                <p className="text-xs text-ink-400">{formatDate(p.created_at)}</p>
                {!p.is_active && <Badge variant="error">Inactive</Badge>}
              </div>
              <div className="flex gap-1">
                <button onClick={() => openCustomer(p)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Eye className="h-4 w-4" /></button>
                {p.is_active && <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Customer detail */}
      <Modal open={!!selected} onClose={() => setSelected(null)} title="Customer Profile" className="max-w-2xl">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-ink-50 p-4 space-y-1.5 text-sm">
              <p className="font-bold text-ink-900 text-base">{selected.profile.full_name || 'Unknown'}</p>
              <p className="flex items-center gap-2 text-ink-700"><Mail className="h-4 w-4 text-ink-400" /> {selected.profile.email}</p>
              {selected.profile.mobile && <p className="flex items-center gap-2 text-ink-700"><Phone className="h-4 w-4 text-ink-400" /> {selected.profile.mobile}</p>}
              <p className="text-ink-500 text-xs">Joined: {formatDate(selected.profile.created_at)}</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl border border-ink-100 p-3 text-center">
                <p className="text-xs text-ink-500">Total Orders</p>
                <p className="text-lg font-bold text-ink-900">{selected.orders.length}</p>
              </div>
              <div className="rounded-xl border border-ink-100 p-3 text-center">
                <p className="text-xs text-ink-500">Total Paid</p>
                <p className="text-lg font-bold text-success-600">{formatINR(selected.totalPaid)}</p>
              </div>
            </div>

            {selected.addresses.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-ink-900 mb-2">Addresses</h3>
                <div className="space-y-2">
                  {selected.addresses.map((a) => (
                    <div key={a.id} className="rounded-xl border border-ink-100 p-3 text-sm">
                      <p className="font-semibold text-ink-900">{a.full_name} · {a.mobile}</p>
                      <p className="flex items-start gap-2 text-ink-600"><MapPin className="h-3.5 w-3.5 mt-0.5" /> {a.line1}, {a.city}, {a.state} - {a.pincode}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selected.orders.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-ink-900 mb-2">Orders</h3>
                <div className="space-y-1.5">
                  {selected.orders.map((o) => (
                    <div key={o.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-2.5 text-sm">
                      <div>
                        <p className="font-semibold text-ink-900">#{o.order_number}</p>
                        <p className="text-xs text-ink-500">{formatDate(o.created_at)}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatINR(o.total)}</p>
                        <Badge variant={o.payment_status === 'Paid' ? 'success' : 'warning'}>{o.payment_status}</Badge>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Customer" message="The customer's profile will be deactivated and personal info anonymized. Order history will be preserved for business records." confirmLabel="Delete" danger />
    </div>
  );
}
