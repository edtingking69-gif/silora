import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminCoupons } from '@/services/api';
import type { Coupon } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, formatDate } from '@/utils/format';
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react';

export function AdminCoupons() {
  const { toast } = useToast();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Coupon | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', discount_type: 'percentage' as 'percentage' | 'fixed', discount_value: '', min_order: '', max_usage: '', expires_at: '', is_active: true });

  async function load() {
    setLoading(true);
    setCoupons(await fetchAdminCoupons());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ code: '', description: '', discount_type: 'percentage', discount_value: '', min_order: '', max_usage: '', expires_at: '', is_active: true });
    setShowModal(true);
  }

  function openEdit(c: Coupon) {
    setEditing(c);
    setForm({
      code: c.code, description: c.description ?? '', discount_type: c.discount_type,
      discount_value: String(c.discount_value), min_order: String(c.min_order),
      max_usage: c.max_usage ? String(c.max_usage) : '', expires_at: c.expires_at ? c.expires_at.slice(0, 10) : '', is_active: c.is_active,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.code || !form.discount_value) { toast('Code and discount value are required', 'error'); return; }
    if (Number(form.discount_value) < 0) { toast('Discount cannot be negative', 'error'); return; }
    setSaving(true);
    try {
      const data = {
        code: form.code.toUpperCase(),
        description: form.description || null,
        discount_type: form.discount_type,
        discount_value: Number(form.discount_value),
        min_order: Number(form.min_order) || 0,
        max_usage: form.max_usage ? Number(form.max_usage) : null,
        expires_at: form.expires_at ? new Date(form.expires_at).toISOString() : null,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('coupons').update(data).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('coupons').insert(data);
        if (error) throw error;
      }
      toast(editing ? 'Updated' : 'Coupon added');
      setShowModal(false);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;
    const { error } = await supabase.from('coupons').delete().eq('id', deleteId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Deleted');
    setDeleteId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Coupons ({coupons.length})</h1>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : coupons.length === 0 ? (
        <EmptyState icon={<Ticket className="h-8 w-8" />} title="No coupons" message="Create discount coupons for customers." action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add Coupon</Button>} />
      ) : (
        <div className="space-y-2">
          {coupons.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600"><Ticket className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-ink-900 font-mono">{c.code}</p>
                <p className="text-xs text-ink-500">
                  {c.discount_type === 'percentage' ? `${c.discount_value}% off` : `${formatINR(c.discount_value)} off`}
                  {c.min_order > 0 && ` · Min ${formatINR(c.min_order)}`}
                  {c.expires_at && ` · Exp ${formatDate(c.expires_at)}`}
                </p>
                <p className="text-xs text-ink-400">Used: {c.usage_count}{c.max_usage ? `/${c.max_usage}` : ''}</p>
              </div>
              <Badge variant={c.is_active ? 'success' : 'default'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
              <div className="flex gap-1">
                <button onClick={() => openEdit(c)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDeleteId(c.id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Coupon' : 'Add Coupon'}>
        <div className="space-y-4">
          <Input label="Code *" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="SAVE10" />
          <Input label="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="Discount Type" value={form.discount_type} onChange={(e) => setForm({ ...form, discount_type: e.target.value as 'percentage' | 'fixed' })}>
              <option value="percentage">Percentage</option>
              <option value="fixed">Fixed Amount</option>
            </Select>
            <Input label="Discount Value *" type="number" value={form.discount_value} onChange={(e) => setForm({ ...form, discount_value: e.target.value })} placeholder={form.discount_type === 'percentage' ? '10' : '100'} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Order (₹)" type="number" value={form.min_order} onChange={(e) => setForm({ ...form, min_order: e.target.value })} />
            <Input label="Max Usage" type="number" value={form.max_usage} onChange={(e) => setForm({ ...form, max_usage: e.target.value })} placeholder="Unlimited" />
          </div>
          <Input label="Expiry Date" type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={(e) => setForm({ ...form, is_active: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
            <span className="text-sm font-medium text-ink-700">Active</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">{editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Coupon" message="Are you sure?" confirmLabel="Delete" danger />
    </div>
  );
}
