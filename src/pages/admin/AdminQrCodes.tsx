import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET } from '@/lib/supabase';
import { fetchAdminPaymentMethods } from '@/services/api';
import type { PaymentMethod, PaymentQrCode } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Select, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { Plus, Pencil, Trash2, QrCode, Upload, X } from 'lucide-react';

export function AdminQrCodes() {
  const { toast } = useToast();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [qrCodes, setQrCodes] = useState<{ qr: PaymentQrCode; methodName: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PaymentQrCode | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({ payment_method_id: '', name: '', description: '', image_url: '', enabled: true, display_order: '0' });

  async function load() {
    setLoading(true);
    const m = await fetchAdminPaymentMethods();
    setMethods(m);
    const qrs: { qr: PaymentQrCode; methodName: string }[] = [];
    m.forEach((method) => {
      method.payment_qr_codes?.forEach((qr) => qrs.push({ qr, methodName: method.name }));
    });
    qrs.sort((a, b) => a.qr.display_order - b.qr.display_order);
    setQrCodes(qrs);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ payment_method_id: methods[0]?.id ?? '', name: '', description: '', image_url: '', enabled: true, display_order: '0' });
    setShowModal(true);
  }

  function openEdit(qr: PaymentQrCode) {
    setEditing(qr);
    setForm({ payment_method_id: qr.payment_method_id, name: qr.name, description: qr.description ?? '', image_url: qr.image_url, enabled: qr.enabled, display_order: String(qr.display_order) });
    setShowModal(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `qr-codes/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600' });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
      toast('QR uploaded');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.payment_method_id || !form.name || !form.image_url) { toast('Payment method, name, and QR image are required', 'error'); return; }
    setSaving(true);
    try {
      const data = {
        payment_method_id: form.payment_method_id,
        name: form.name,
        description: form.description || null,
        image_url: form.image_url,
        enabled: form.enabled,
        display_order: Number(form.display_order) || 0,
      };
      if (editing) {
        const { error } = await supabase.from('payment_qr_codes').update(data).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('payment_qr_codes').insert(data);
        if (error) throw error;
      }
      await supabase.rpc('log_admin_action', { p_action: 'QR Added', p_target: 'qr_code', p_target_id: editing?.id ?? null });
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
    const { error } = await supabase.from('payment_qr_codes').delete().eq('id', deleteId);
    if (error) { toast(error.message, 'error'); return; }
    toast('Deleted');
    setDeleteId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">QR Codes ({qrCodes.length})</h1>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add QR</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">{[1,2,3].map((i) => <div key={i} className="h-48 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : qrCodes.length === 0 ? (
        <EmptyState icon={<QrCode className="h-8 w-8" />} title="No QR codes" message="Add QR codes for UPI payments." action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add QR</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {qrCodes.map(({ qr, methodName }) => (
            <div key={qr.id} className="rounded-2xl border border-ink-100 bg-white p-3">
              <div className="relative mb-2 h-32 overflow-hidden rounded-xl bg-white">
                <img src={qr.image_url} alt={qr.name} className="h-full w-full object-contain" />
                {!qr.enabled && <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60"><span className="text-xs font-bold text-white">Disabled</span></div>}
              </div>
              <p className="text-sm font-bold text-ink-900 truncate">{qr.name}</p>
              <p className="text-xs text-ink-500">{methodName}</p>
              <div className="mt-2 flex items-center justify-between">
                <Badge variant={qr.enabled ? 'success' : 'default'}>{qr.enabled ? 'Active' : 'Disabled'}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(qr)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteId(qr.id)} className="rounded-lg p-1.5 text-error-500 hover:bg-error-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit QR Code' : 'Add QR Code'}>
        <div className="space-y-4">
          <Select label="Payment Method *" value={form.payment_method_id} onChange={(e) => setForm({ ...form, payment_method_id: e.target.value })}>
            <option value="">Select method</option>
            {methods.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
          </Select>
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main UPI QR" />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />

          <div>
            <label className="text-sm font-semibold text-ink-800">QR Image *</label>
            <div className="mt-1.5 flex gap-2">
              {form.image_url && (
                <div className="relative h-24 w-24 overflow-hidden rounded-xl border border-ink-200 bg-white">
                  <img src={form.image_url} alt="" className="h-full w-full object-contain" />
                  <button onClick={() => setForm({ ...form, image_url: '' })} className="absolute right-0.5 top-0.5 rounded-full bg-error-600 p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              )}
              <label className="flex h-24 w-24 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-ink-400 hover:border-primary-400">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
                {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /> : <Upload className="h-5 w-5" />}
              </label>
            </div>
          </div>

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

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete QR Code" message="Are you sure?" confirmLabel="Delete" danger />
    </div>
  );
}
