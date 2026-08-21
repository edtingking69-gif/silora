import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminPaymentMethods } from '@/services/api';
import type { PaymentMethod, PaymentMethodType } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { Plus, Pencil, Trash2, CreditCard, QrCode as QrIcon } from 'lucide-react';

const TYPES: PaymentMethodType[] = ['upi', 'upi_qr', 'cod', 'gateway', 'other'];

export function AdminPaymentMethods() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PaymentMethod | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'upi' as PaymentMethodType, description: '', instructions: '', upi_id: '', enabled: true, display_order: '0' });

  async function load() {
    setLoading(true);
    setMethods(await fetchAdminPaymentMethods());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', type: 'upi', description: '', instructions: '', upi_id: '', enabled: true, display_order: '0' });
    setShowModal(true);
  }

  function openEdit(m: PaymentMethod) {
    setEditing(m);
    setForm({ name: m.name, type: m.type, description: m.description ?? '', instructions: m.instructions ?? '', upi_id: m.upi_id ?? '', enabled: m.enabled, display_order: String(m.display_order) });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const data = {
        name: form.name, type: form.type, description: form.description || null,
        instructions: form.instructions || null, upi_id: form.upi_id || null,
        enabled: form.enabled, display_order: Number(form.display_order) || 0,
      };
      if (editing) {
        const { error } = await supabase.from('payment_methods').update(data).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_methods').insert(data);
        if (error) throw error;
      }
      await supabase.rpc('log_admin_action', { p_action: 'Payment Method Changed', p_target: 'payment_method', p_target_id: editing?.id ?? null });
      toast(editing ? 'Updated' : 'Added');
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
    const { error } = await supabase.from('payment_methods').delete().eq('id', deleteId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Deleted');
    setDeleteId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Payment Methods</h1>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : methods.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-8 w-8" />} title="No payment methods" message="Add payment methods for checkout." action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add</Button>} />
      ) : (
        <div className="space-y-2">
          {methods.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-600">
                {m.type === 'upi' || m.type === 'upi_qr' ? <QrIcon className="h-5 w-5" /> : <CreditCard className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900">{m.name}</p>
                <p className="text-xs text-ink-500 uppercase">{m.type}{m.upi_id ? ` · ${m.upi_id}` : ''}</p>
              </div>
              <Badge variant={m.enabled ? 'success' : 'default'}>{m.enabled ? 'Enabled' : 'Disabled'}</Badge>
              <div className="flex gap-1">
                <button onClick={() => openEdit(m)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDeleteId(m.id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Payment Method' : 'Add Payment Method'}>
        <div className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. UPI Payment" />
          <Select label="Type" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as PaymentMethodType })}>
            {TYPES.map((t) => <option key={t} value={t}>{t.toUpperCase()}</option>)}
          </Select>
          <Input label="UPI ID" value={form.upi_id} onChange={(e) => setForm({ ...form, upi_id: e.target.value })} placeholder="example@upi" />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Textarea label="Instructions" rows={3} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Payment instructions for customer" />
          <Input label="Display Order" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
            <span className="text-sm font-medium text-ink-700">Enabled</span>
          </label>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">{editing ? 'Update' : 'Add'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Payment Method" message="This will remove the payment method and its QR codes." confirmLabel="Delete" danger />
    </div>
  );
}
