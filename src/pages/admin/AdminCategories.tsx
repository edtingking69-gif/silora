import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET } from '@/lib/supabase';
import { fetchAllCategoriesAdmin } from '@/services/api';
import type { Category } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { slugify } from '@/utils/format';
import { Plus, Pencil, Trash2, Tag, Upload, X } from 'lucide-react';

export function AdminCategories() {
  const { toast } = useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', image_url: '', display_order: '0', is_active: true });
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const c = await fetchAllCategoriesAdmin();
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm({ name: '', description: '', image_url: '', display_order: '0', is_active: true });
    setShowModal(true);
  }

  function openEdit(c: Category) {
    setEditing(c);
    setForm({ name: c.name, description: c.description ?? '', image_url: c.image_url ?? '', display_order: String(c.display_order), is_active: c.is_active });
    setShowModal(true);
  }

  async function handleUpload(file: File) {
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `categories/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600' });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setForm((f) => ({ ...f, image_url: urlData.publicUrl }));
      toast('Image uploaded');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name) { toast('Name is required', 'error'); return; }
    setSaving(true);
    try {
      const slug = slugify(form.name) + (editing ? '' : '-' + Math.random().toString(36).slice(2, 6));
      const data = {
        name: form.name,
        slug: editing ? editing.slug : slug,
        description: form.description || null,
        image_url: form.image_url || null,
        display_order: Number(form.display_order) || 0,
        is_active: form.is_active,
      };
      if (editing) {
        const { error } = await supabase.from('categories').update(data).eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert(data);
        if (error) throw error;
      }
      await supabase.rpc('log_admin_action', { p_action: editing ? 'Category Updated' : 'Category Added', p_target: 'category', p_target_id: editing?.id ?? null });
      toast(editing ? 'Category updated' : 'Category added');
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
    const { error } = await supabase.from('categories').delete().eq('id', deleteId);
    if (error) { toast(error.message, 'error'); return; }
    await supabase.rpc('log_admin_action', { p_action: 'Category Deleted', p_target: 'category', p_target_id: deleteId });
    toast('Category deleted');
    setDeleteId(null);
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Categories ({categories.length})</h1>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add</Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-32 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : categories.length === 0 ? (
        <EmptyState icon={<Tag className="h-8 w-8" />} title="No categories" message="Add your first category." action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add Category</Button>} />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {categories.map((c) => (
            <div key={c.id} className="rounded-2xl border border-ink-100 bg-white p-3">
              <div className="relative mb-2 h-20 overflow-hidden rounded-xl bg-ink-100">
                {c.image_url ? <img src={c.image_url} alt={c.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center bg-primary-50 text-2xl font-bold text-primary-600">{c.name.charAt(0)}</div>}
                {!c.is_active && <div className="absolute inset-0 flex items-center justify-center bg-ink-900/60"><span className="text-xs font-bold text-white">Inactive</span></div>}
              </div>
              <p className="text-sm font-bold text-ink-900 truncate">{c.name}</p>
              <div className="mt-1 flex items-center justify-between">
                <Badge variant={c.is_active ? 'success' : 'default'}>{c.is_active ? 'Active' : 'Inactive'}</Badge>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(c)} className="rounded-lg p-1.5 text-ink-500 hover:bg-ink-100"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setDeleteId(c.id)} className="rounded-lg p-1.5 text-error-500 hover:bg-error-50"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Category' : 'Add Category'}>
        <div className="space-y-4">
          <Input label="Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <Input label="Display Order" type="number" value={form.display_order} onChange={(e) => setForm({ ...form, display_order: e.target.value })} />
          <div>
            <label className="text-sm font-semibold text-ink-800">Category Image</label>
            <div className="mt-1.5 flex gap-2">
              {form.image_url && (
                <div className="relative h-20 w-20 overflow-hidden rounded-xl border border-ink-200">
                  <img src={form.image_url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setForm({ ...form, image_url: '' })} className="absolute right-0.5 top-0.5 rounded-full bg-error-600 p-0.5 text-white"><X className="h-3 w-3" /></button>
                </div>
              )}
              <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-ink-400 hover:border-primary-400">
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
                {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /> : <Upload className="h-5 w-5" />}
              </label>
            </div>
          </div>
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

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Category" message="Products in this category will have no category. Are you sure?" confirmLabel="Delete" danger />
    </div>
  );
}
