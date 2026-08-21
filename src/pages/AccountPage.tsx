import { useEffect, useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { fetchUserAddresses, fetchUserOrders } from '@/services/api';
import type { Address, Order } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDate } from '@/utils/format';
import { User, MapPin, Package, LogOut, Plus, Pencil, Trash2, Mail, Phone, ChevronRight } from 'lucide-react';

export function AccountPage() {
  const { user, profile, signOut, refreshProfile } = useAuth();
  const { toast } = useToast();

  const [tab, setTab] = useState<'profile' | 'addresses' | 'orders'>('profile');
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [editProfile, setEditProfile] = useState(false);
  const [profileForm, setProfileForm] = useState({ full_name: '', mobile: '' });
  const [savingProfile, setSavingProfile] = useState(false);

  const [showAddrModal, setShowAddrModal] = useState(false);
  const [editingAddr, setEditingAddr] = useState<Address | null>(null);
  const [addrForm, setAddrForm] = useState({ label: 'Home', full_name: '', mobile: '', line1: '', line2: '', city: '', state: '', pincode: '' });
  const [savingAddr, setSavingAddr] = useState(false);
  const [deleteAddrId, setDeleteAddrId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    setProfileForm({ full_name: profile?.full_name ?? '', mobile: profile?.mobile ?? '' });
    fetchUserAddresses(user.id).then(setAddresses);
    fetchUserOrders(user.id).then(setOrders);
  }, [user, profile]);

  async function handleSaveProfile() {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase.from('profiles').update({
      full_name: profileForm.full_name,
      mobile: profileForm.mobile,
    }).eq('id', user.id);
    setSavingProfile(false);
    if (error) { toast(error.message, 'error'); return; }
    await refreshProfile();
    setEditProfile(false);
    toast('Profile updated');
  }

  function openAddAddr() {
    setEditingAddr(null);
    setAddrForm({ label: 'Home', full_name: profile?.full_name ?? '', mobile: profile?.mobile ?? '', line1: '', line2: '', city: '', state: '', pincode: '' });
    setShowAddrModal(true);
  }

  function openEditAddr(addr: Address) {
    setEditingAddr(addr);
    setAddrForm({ label: addr.label, full_name: addr.full_name, mobile: addr.mobile, line1: addr.line1, line2: addr.line2 ?? '', city: addr.city, state: addr.state, pincode: addr.pincode });
    setShowAddrModal(true);
  }

  async function handleSaveAddr() {
    if (!user) return;
    if (!addrForm.full_name || !addrForm.mobile || !addrForm.line1 || !addrForm.city || !addrForm.state || !addrForm.pincode) {
      toast('Please fill all required fields', 'error'); return;
    }
    setSavingAddr(true);
    let hadError = false;
    if (editingAddr) {
      const { error } = await supabase.from('addresses').update(addrForm).eq('id', editingAddr.id);
      if (error) { toast(error.message, 'error'); hadError = true; }
      else toast('Address updated');
    } else {
      const { error } = await supabase.from('addresses').insert({ ...addrForm, user_id: user.id });
      if (error) { toast(error.message, 'error'); hadError = true; }
      else toast('Address added');
    }
    setSavingAddr(false);
    if (!hadError) {
      setShowAddrModal(false);
      fetchUserAddresses(user.id).then(setAddresses);
    }
  }

  async function handleDeleteAddr() {
    if (!deleteAddrId) return;
    const { error } = await supabase.from('addresses').delete().eq('id', deleteAddrId);
    if (error) toast(error.message, 'error');
    else toast('Address deleted');
    setDeleteAddrId(null);
    if (user) fetchUserAddresses(user.id).then(setAddresses);
  }

  if (!user) return null;

  const tabs = [
    { id: 'profile' as const, label: 'Profile', icon: User },
    { id: 'addresses' as const, label: 'Addresses', icon: MapPin },
    { id: 'orders' as const, label: 'Orders', icon: Package },
  ];

  return (
    <div className="container-silora py-6">
      <h1 className="text-xl font-bold text-ink-900 sm:text-2xl mb-5">My Account</h1>

      {/* User card */}
      <div className="mb-6 flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-5">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-100 text-xl font-bold text-primary-700">
          {(profile?.full_name ?? user.email ?? 'U').charAt(0).toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold text-ink-900 truncate">{profile?.full_name || 'SILORA Customer'}</p>
          <p className="text-sm text-ink-500 truncate">{user.email}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => signOut().then(() => navigate('/'))}>
          <LogOut className="h-4 w-4" /> Logout
        </Button>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex gap-1 rounded-xl border border-ink-100 bg-white p-1">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2.5 text-sm font-semibold transition-colors ${
              tab === t.id ? 'bg-primary-600 text-white' : 'text-ink-600 hover:bg-ink-100'
            }`}
          >
            <t.icon className="h-4 w-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* Profile tab */}
      {tab === 'profile' && (
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          {!editProfile ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Mail className="h-5 w-5 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500">Email</p>
                  <p className="text-sm font-semibold text-ink-900">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="h-5 w-5 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500">Full Name</p>
                  <p className="text-sm font-semibold text-ink-900">{profile?.full_name || 'Not set'}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500">Mobile</p>
                  <p className="text-sm font-semibold text-ink-900">{profile?.mobile || 'Not set'}</p>
                </div>
              </div>
              <Button onClick={() => setEditProfile(true)} variant="outline">Edit Profile</Button>
            </div>
          ) : (
            <div className="space-y-4">
              <Input label="Full Name" value={profileForm.full_name} onChange={(e) => setProfileForm({ ...profileForm, full_name: e.target.value })} />
              <Input label="Mobile" value={profileForm.mobile} onChange={(e) => setProfileForm({ ...profileForm, mobile: e.target.value })} maxLength={10} />
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setEditProfile(false)}>Cancel</Button>
                <Button onClick={handleSaveProfile} loading={savingProfile}>Save</Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Addresses tab */}
      {tab === 'addresses' && (
        <div>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-ink-900">Saved Addresses</h2>
            <Button size="sm" onClick={openAddAddr}><Plus className="h-4 w-4" /> Add</Button>
          </div>
          {addresses.length === 0 ? (
            <EmptyState icon={<MapPin className="h-8 w-8" />} title="No addresses yet" message="Add a delivery address to speed up checkout." />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {addresses.map((addr) => (
                <div key={addr.id} className="rounded-2xl border border-ink-100 bg-white p-4">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="inline-block rounded-full bg-primary-50 px-2 py-0.5 text-xs font-semibold text-primary-700">{addr.label}</span>
                      <p className="mt-2 text-sm font-semibold text-ink-900">{addr.full_name} · {addr.mobile}</p>
                      <p className="mt-1 text-sm text-ink-600">{addr.line1}{addr.line2 ? `, ${addr.line2}` : ''}, {addr.city}, {addr.state} - {addr.pincode}</p>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => openEditAddr(addr)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => setDeleteAddrId(addr.id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Orders tab */}
      {tab === 'orders' && (
        <div>
          <h2 className="mb-4 text-base font-bold text-ink-900">Order History</h2>
          {orders.length === 0 ? (
            <EmptyState
              icon={<Package className="h-8 w-8" />}
              title="No orders yet"
              message="Your orders will appear here once you start shopping."
              action={<Link to="/products" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">Start Shopping</Link>}
            />
          ) : (
            <div className="space-y-3">
              {orders.map((order) => (
                <Link
                  key={order.id}
                  to={`/account/orders/${order.id}`}
                  className="flex items-center gap-4 rounded-2xl border border-ink-100 bg-white p-4 transition-all hover:shadow-card-hover"
                >
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary-600">
                    <Package className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-ink-900">#{order.order_number}</p>
                    <p className="text-xs text-ink-500">{formatDate(order.created_at)} · {order.order_items?.length ?? 0} items</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-ink-900">{formatINR(order.total)}</p>
                    <span className={`text-xs font-semibold ${
                      order.payment_status === 'Paid' ? 'text-success-600' :
                      order.payment_status === 'Failed' || order.payment_status === 'Cancelled' ? 'text-error-600' :
                      'text-warning-600'
                    }`}>{order.payment_status}</span>
                  </div>
                  <ChevronRight className="h-5 w-5 text-ink-300" />
                </Link>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Address modal */}
      <Modal
        open={showAddrModal}
        onClose={() => setShowAddrModal(false)}
        title={editingAddr ? 'Edit Address' : 'Add Address'}
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <Select label="Label" value={addrForm.label} onChange={(e) => setAddrForm({ ...addrForm, label: e.target.value })}>
            <option>Home</option><option>Work</option><option>Other</option>
          </Select>
          <Input label="Full Name *" value={addrForm.full_name} onChange={(e) => setAddrForm({ ...addrForm, full_name: e.target.value })} />
          <Input label="Mobile *" value={addrForm.mobile} onChange={(e) => setAddrForm({ ...addrForm, mobile: e.target.value })} maxLength={10} />
          <div className="sm:col-span-2"><Input label="Address Line 1 *" value={addrForm.line1} onChange={(e) => setAddrForm({ ...addrForm, line1: e.target.value })} /></div>
          <div className="sm:col-span-2"><Input label="Address Line 2" value={addrForm.line2} onChange={(e) => setAddrForm({ ...addrForm, line2: e.target.value })} /></div>
          <Input label="City *" value={addrForm.city} onChange={(e) => setAddrForm({ ...addrForm, city: e.target.value })} />
          <Input label="State *" value={addrForm.state} onChange={(e) => setAddrForm({ ...addrForm, state: e.target.value })} />
          <Input label="Pincode *" value={addrForm.pincode} onChange={(e) => setAddrForm({ ...addrForm, pincode: e.target.value })} maxLength={6} />
        </div>
        <div className="mt-4 flex gap-3">
          <Button variant="outline" onClick={() => setShowAddrModal(false)}>Cancel</Button>
          <Button onClick={handleSaveAddr} loading={savingAddr}>{editingAddr ? 'Update' : 'Add Address'}</Button>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!deleteAddrId}
        onClose={() => setDeleteAddrId(null)}
        onConfirm={handleDeleteAddr}
        title="Delete Address"
        message="Are you sure you want to delete this address?"
        confirmLabel="Delete"
        danger
      />
    </div>
  );
}
