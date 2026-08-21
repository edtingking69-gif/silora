import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { STORAGE_BUCKET } from '@/lib/supabase';
import { fetchAllProductsAdmin, fetchAllCategoriesAdmin } from '@/services/api';
import type { Product, Category } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, slugify, classNames } from '@/utils/format';
import { Plus, Pencil, Trash2, Search, Package, Upload, X } from 'lucide-react';

export function AdminProducts() {
  const { toast } = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const emptyForm = {
    name: '', description: '', price: '', original_price: '', stock: '', sku: '',
    category_id: '', is_featured: false, is_bestseller: false, is_trending: false, is_new: true, is_active: true,
  };
  const [form, setForm] = useState(emptyForm);
  const [images, setImages] = useState<{ url: string; alt?: string }[]>([]);
  const [uploading, setUploading] = useState(false);

  async function load() {
    setLoading(true);
    const [p, c] = await Promise.all([fetchAllProductsAdmin(), fetchAllCategoriesAdmin()]);
    setProducts(p);
    setCategories(c);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setImages([]);
    setShowModal(true);
  }

  function openEdit(p: Product) {
    setEditing(p);
    setForm({
      name: p.name, description: p.description ?? '', price: String(p.price), original_price: p.original_price ? String(p.original_price) : '',
      stock: String(p.stock), sku: p.sku ?? '', category_id: p.category_id ?? '',
      is_featured: p.is_featured, is_bestseller: p.is_bestseller, is_trending: p.is_trending, is_new: p.is_new, is_active: p.is_active,
    });
    setImages((p.product_images ?? []).sort((a, b) => a.display_order - b.display_order).map((i) => ({ url: i.url, alt: i.alt ?? '' })));
    setShowModal(true);
  }

  async function handleUpload(file: File) {
    if (!file) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { cacheControl: '3600', upsert: false });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setImages((prev) => [...prev, { url: urlData.publicUrl, alt: '' }]);
      toast('Image uploaded');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Upload failed', 'error');
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    if (!form.name || !form.price) { toast('Name and price are required', 'error'); return; }
    if (Number(form.price) < 0) { toast('Price cannot be negative', 'error'); return; }
    if (form.stock && Number(form.stock) < 0) { toast('Stock cannot be negative', 'error'); return; }

    setSaving(true);
    try {
      const slug = slugify(form.name) + '-' + Math.random().toString(36).slice(2, 6);
      const productData = {
        name: form.name,
        slug,
        description: form.description,
        price: Number(form.price),
        original_price: form.original_price ? Number(form.original_price) : null,
        stock: Number(form.stock) || 0,
        sku: form.sku || null,
        category_id: form.category_id || null,
        is_featured: form.is_featured,
        is_bestseller: form.is_bestseller,
        is_trending: form.is_trending,
        is_new: form.is_new,
        is_active: form.is_active,
      };

      let productId = editing?.id;
      if (editing) {
        const { error } = await supabase.from('products').update(productData).eq('id', editing.id);
        if (error) throw error;
        // Replace images
        await supabase.from('product_images').delete().eq('product_id', editing.id);
      } else {
        const { data, error } = await supabase.from('products').insert(productData).select().single();
        if (error) throw error;
        productId = data.id;
      }

      if (productId && images.length > 0) {
        await supabase.from('product_images').insert(
          images.map((img, i) => ({ product_id: productId, url: img.url, alt: img.alt ?? null, display_order: i })),
        );
      }

      await supabase.rpc('log_admin_action', {
        p_action: editing ? 'Product Updated' : 'Product Added',
        p_target: 'product', p_target_id: productId,
      });

      toast(editing ? 'Product updated' : 'Product added');
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
    const product = products.find((p) => p.id === deleteId);
    // Check if product exists in orders
    const { count } = await supabase.from('order_items').select('id', { count: 'exact' }).eq('product_id', deleteId);
    if (count && count > 0) {
      // Deactivate instead of delete
      const { error } = await supabase.from('products').update({ is_active: false }).eq('id', deleteId);
      if (error) { toast(error.message, 'error'); return; }
      toast('Product deactivated (exists in orders — record preserved)');
    } else {
      const { error } = await supabase.from('products').delete().eq('id', deleteId);
      if (error) { toast(error.message, 'error'); return; }
      toast('Product deleted');
    }
    await supabase.rpc('log_admin_action', { p_action: 'Product Deleted', p_target: 'product', p_target_id: deleteId });
    setDeleteId(null);
    load();
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Products ({products.length})</h1>
        <Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add Product</Button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<Package className="h-8 w-8" />} title="No products" message="Add your first product to get started." action={<Button onClick={openAdd} size="sm"><Plus className="h-4 w-4" /> Add Product</Button>} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">
                {p.product_images?.[0]?.url ? <img src={p.product_images[0].url} alt={p.name} className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-ink-300"><Package className="h-6 w-6" /></div>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-ink-900 truncate">{p.name}</p>
                <p className="text-sm font-bold text-primary-600">{formatINR(p.price)}</p>
                <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                  <Badge variant={p.stock > 5 ? 'success' : p.stock > 0 ? 'warning' : 'error'}>{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</Badge>
                  {!p.is_active && <Badge variant="error">Inactive</Badge>}
                  {p.is_featured && <Badge variant="primary">Featured</Badge>}
                  {p.is_bestseller && <Badge variant="info">Bestseller</Badge>}
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => openEdit(p)} className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDeleteId(p.id)} className="rounded-lg p-2 text-error-500 hover:bg-error-50"><Trash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title={editing ? 'Edit Product' : 'Add Product'} className="max-w-2xl">
        <div className="space-y-4">
          <Input label="Product Name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <Textarea label="Description" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <div className="grid gap-3 sm:grid-cols-3">
            <Input label="Price (₹) *" type="number" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            <Input label="Original Price (₹)" type="number" value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} />
            <Input label="Stock" type="number" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Input label="SKU" value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} />
            <Select label="Category" value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })}>
              <option value="">No category</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </div>

          {/* Images */}
          <div>
            <label className="text-sm font-semibold text-ink-800">Product Images</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {images.map((img, i) => (
                <div key={i} className="relative h-20 w-20 overflow-hidden rounded-xl border border-ink-200">
                  <img src={img.url} alt="" className="h-full w-full object-cover" />
                  <button onClick={() => setImages(images.filter((_, idx) => idx !== i))} className="absolute right-0.5 top-0.5 rounded-full bg-error-600 p-0.5 text-white">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
              <label className={classNames('flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-ink-300 text-ink-400 hover:border-primary-400 hover:text-primary-500', uploading && 'opacity-50')}>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} disabled={uploading} />
                {uploading ? <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-200 border-t-primary-600" /> : <Upload className="h-5 w-5" />}
              </label>
            </div>
          </div>

          {/* Flags */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {([
              { key: 'is_featured', label: 'Featured' },
              { key: 'is_bestseller', label: 'Bestseller' },
              { key: 'is_trending', label: 'Trending' },
              { key: 'is_new', label: 'New Arrival' },
              { key: 'is_active', label: 'Active' },
            ] as const).map((flag) => (
              <label key={flag.key} className="flex items-center gap-2 cursor-pointer rounded-xl border border-ink-200 px-3 py-2">
                <input type="checkbox" checked={form[flag.key]} onChange={(e) => setForm({ ...form, [flag.key]: e.target.checked })} className="h-4 w-4 rounded text-primary-600" />
                <span className="text-sm font-medium text-ink-700">{flag.label}</span>
              </label>
            ))}
          </div>

          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
            <Button onClick={handleSave} loading={saving} className="flex-1">{editing ? 'Update' : 'Add Product'}</Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog open={!!deleteId} onClose={() => setDeleteId(null)} onConfirm={handleDelete} title="Delete Product" message="If this product exists in past orders, it will be deactivated instead of deleted to preserve order history." confirmLabel="Delete" danger />
    </div>
  );
}
