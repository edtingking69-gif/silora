import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchAllProductsAdmin,
  fetchAllCategoriesAdmin,
} from '@/services/api';
import type { Product, Category } from '@/types';

import { Button } from '@/components/ui/Button';
import { Input, Textarea, Select } from '@/components/ui/Input';
import { Modal, ConfirmDialog } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';

import { useToast } from '@/contexts/ToastContext';
import { formatINR, slugify } from '@/utils/format';

import {
  Plus,
  Pencil,
  Trash2,
  Search,
  Package,
  X,
} from 'lucide-react';

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
    name: '',
    description: '',
    price: '',
    original_price: '',
    stock: '',
    sku: '',
    category_id: '',
    image_url: '',
    is_featured: false,
    is_bestseller: false,
    is_trending: false,
    is_new: true,
    is_active: true,
  };

  const [form, setForm] = useState(emptyForm);

  async function load() {
    try {
      setLoading(true);

      const [productsData, categoriesData] = await Promise.all([
        fetchAllProductsAdmin(),
        fetchAllCategoriesAdmin(),
      ]);

      setProducts(productsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error('LOAD ERROR:', error);

      toast('Failed to load products', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm);
    setShowModal(true);
  }

  function openEdit(product: Product) {
    setEditing(product);

    setForm({
      name: product.name,
      description: product.description ?? '',
      price: String(product.price),

      original_price: product.original_price
        ? String(product.original_price)
        : '',

      stock: String(product.stock ?? 0),

      sku: product.sku ?? '',

      category_id: product.category_id ?? '',

      image_url: product.image_url ?? '',

      is_featured: product.is_featured ?? false,

      is_bestseller: product.is_bestseller ?? false,

      is_trending: product.is_trending ?? false,

      is_new: product.is_new ?? false,

      is_active: product.is_active ?? true,
    });

    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast('Product name is required', 'error');
      return;
    }

    if (!form.price) {
      toast('Price is required', 'error');
      return;
    }

    if (Number(form.price) < 0) {
      toast('Price cannot be negative', 'error');
      return;
    }

    if (form.stock && Number(form.stock) < 0) {
      toast('Stock cannot be negative', 'error');
      return;
    }

    setSaving(true);

    try {
      const slug = editing
        ? editing.slug
        : `${slugify(form.name)}-${Math.random()
            .toString(36)
            .slice(2, 6)}`;

      const productData = {
        name: form.name.trim(),

        slug,

        description: form.description.trim() || null,

        price: Number(form.price),

        original_price: form.original_price
          ? Number(form.original_price)
          : null,

        stock: form.stock
          ? Number(form.stock)
          : 0,

        sku: form.sku.trim() || null,

        category_id: form.category_id || null,

        image_url: form.image_url.trim() || null,

        is_featured: form.is_featured,

        is_bestseller: form.is_bestseller,

        is_trending: form.is_trending,

        is_new: form.is_new,

        is_active: form.is_active,
      };

      let productId = editing?.id;

      if (editing) {
        const { error } = await supabase
          .from('products')
          .update(productData)
          .eq('id', editing.id);

        if (error) {
          console.error('UPDATE ERROR:', error);
          throw error;
        }

        productId = editing.id;
      } else {
        const { data, error } = await supabase
          .from('products')
          .insert(productData)
          .select()
          .single();

        if (error) {
          console.error('INSERT ERROR:', error);
          throw error;
        }

        productId = data.id;
      }

      /*
      Optional admin audit log.
      This is wrapped separately so a missing RPC
      does not stop the product from being saved.
      */

      try {
        await supabase.rpc('log_admin_action', {
          p_action: editing
            ? 'Product Updated'
            : 'Product Added',

          p_target: 'product',

          p_target_id: productId,
        });
      } catch (auditError) {
        console.warn(
          'Audit log error:',
          auditError
        );
      }

      toast(
        editing
          ? 'Product updated successfully'
          : 'Product added successfully'
      );

      setShowModal(false);

      await load();

    } catch (err) {
      console.error(
        'PRODUCT SAVE ERROR:',
        err
      );

      const message =
        err instanceof Error
          ? err.message
          : 'Save failed';

      toast(message, 'error');

    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleteId) return;

    try {
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', deleteId);

      if (error) {
        throw error;
      }

      toast('Product deleted successfully');

      setDeleteId(null);

      await load();

    } catch (err) {
      console.error('DELETE ERROR:', err);

      toast(
        err instanceof Error
          ? err.message
          : 'Failed to delete product',
        'error'
      );
    }
  }

  const filtered = products.filter((product) =>
    product.name
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">

      {/* HEADER */}

      <div className="flex flex-wrap items-center justify-between gap-3">

        <h1 className="text-lg font-bold text-ink-900 sm:text-xl">
          Products ({products.length})
        </h1>

        <Button
          onClick={openAdd}
          size="sm"
        >
          <Plus className="h-4 w-4" />

          Add Product
        </Button>

      </div>


      {/* SEARCH */}

      <div className="relative">

        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />

        <input
          type="search"

          value={search}

          onChange={(e) =>
            setSearch(e.target.value)
          }

          placeholder="Search products..."

          className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
        />

      </div>


      {/* LOADING */}

      {loading ? (

        <div className="space-y-2">

          {[1, 2, 3].map((item) => (

            <div
              key={item}
              className="h-20 animate-shimmer rounded-2xl bg-ink-100"
            />

          ))}

        </div>

      ) : filtered.length === 0 ? (

        <EmptyState
          icon={<Package className="h-8 w-8" />}

          title="No products"

          message="Add your first product to get started."

          action={
            <Button
              onClick={openAdd}
              size="sm"
            >
              <Plus className="h-4 w-4" />

              Add Product
            </Button>
          }
        />

      ) : (

        <div className="space-y-2">

          {filtered.map((product) => (

            <div
              key={product.id}

              className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-3"
            >

              {/* IMAGE */}

              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-ink-100">

                {product.image_url ? (

                  <img
                    src={product.image_url}
                    alt={product.name}

                    className="h-full w-full object-cover"

                    onError={(e) => {
                      e.currentTarget.style.display =
                        'none';
                    }}
                  />

                ) : (

                  <div className="flex h-full w-full items-center justify-center text-ink-300">

                    <Package className="h-6 w-6" />

                  </div>

                )}

              </div>


              {/* PRODUCT INFO */}

              <div className="min-w-0 flex-1">

                <p className="truncate text-sm font-semibold text-ink-900">

                  {product.name}

                </p>

                <p className="text-sm font-bold text-primary-600">

                  {formatINR(product.price)}

                </p>


                <div className="mt-1 flex flex-wrap items-center gap-1.5">

                  <Badge
                    variant={
                      product.stock > 5
                        ? 'success'
                        : product.stock > 0
                        ? 'warning'
                        : 'error'
                    }
                  >

                    {product.stock > 0
                      ? `${product.stock} in stock`
                      : 'Out of stock'}

                  </Badge>


                  {!product.is_active && (

                    <Badge variant="error">

                      Inactive

                    </Badge>

                  )}


                  {product.is_featured && (

                    <Badge variant="primary">

                      Featured

                    </Badge>

                  )}

                </div>

              </div>


              {/* ACTIONS */}

              <div className="flex gap-1">

                <button
                  onClick={() =>
                    openEdit(product)
                  }

                  className="rounded-lg p-2 text-ink-500 hover:bg-ink-100"
                >

                  <Pencil className="h-4 w-4" />

                </button>


                <button
                  onClick={() =>
                    setDeleteId(product.id)
                  }

                  className="rounded-lg p-2 text-error-500 hover:bg-error-50"
                >

                  <Trash2 className="h-4 w-4" />

                </button>

              </div>

            </div>

          ))}

        </div>

      )}


      {/* ADD / EDIT MODAL */}

      <Modal
        open={showModal}

        onClose={() =>
          setShowModal(false)
        }

        title={
          editing
            ? 'Edit Product'
            : 'Add Product'
        }

        className="max-w-2xl"
      >

        <div className="space-y-4">


          <Input
            label="Product Name *"

            value={form.name}

            onChange={(e) =>
              setForm({
                ...form,
                name: e.target.value,
              })
            }
          />


          <Textarea
            label="Description"

            rows={3}

            value={form.description}

            onChange={(e) =>
              setForm({
                ...form,
                description: e.target.value,
              })
            }
          />


          <div className="grid gap-3 sm:grid-cols-3">


            <Input
              label="Price (₹) *"

              type="number"

              value={form.price}

              onChange={(e) =>
                setForm({
                  ...form,
                  price: e.target.value,
                })
              }
            />


            <Input
              label="Original Price (₹)"

              type="number"

              value={form.original_price}

              onChange={(e) =>
                setForm({
                  ...form,
                  original_price: e.target.value,
                })
              }
            />


            <Input
              label="Stock"

              type="number"

              value={form.stock}

              onChange={(e) =>
                setForm({
                  ...form,
                  stock: e.target.value,
                })
              }
            />

          </div>


          <div className="grid gap-3 sm:grid-cols-2">


            <Input
              label="SKU"

              value={form.sku}

              onChange={(e) =>
                setForm({
                  ...form,
                  sku: e.target.value,
                })
              }
            />


            <Select
              label="Category"

              value={form.category_id}

              onChange={(e) =>
                setForm({
                  ...form,
                  category_id: e.target.value,
                })
              }
            >

              <option value="">
                No category
              </option>

              {categories.map((category) => (

                <option
                  key={category.id}

                  value={category.id}
                >

                  {category.name}

                </option>

              ))}

            </Select>

          </div>


          {/* IMAGE LINK */}

          <div>

            <Input
              label="Product Image Link"

              type="url"

              placeholder="https://example.com/product.jpg"

              value={form.image_url}

              onChange={(e) =>
                setForm({
                  ...form,
                  image_url: e.target.value,
                })
              }
            />


            {form.image_url && (

              <div className="relative mt-3 h-40 w-40 overflow-hidden rounded-xl border border-ink-200">

                <img
                  src={form.image_url}

                  alt="Product preview"

                  className="h-full w-full object-cover"

                  onError={(e) => {
                    e.currentTarget.style.display =
                      'none';
                  }}
                />


                <button
                  type="button"

                  onClick={() =>
                    setForm({
                      ...form,
                      image_url: '',
                    })
                  }

                  className="absolute right-1 top-1 rounded-full bg-error-600 p-1 text-white"
                >

                  <X className="h-3 w-3" />

                </button>

              </div>

            )}

          </div>


          {/* FLAGS */}

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">

            {([
              {
                key: 'is_featured',
                label: 'Featured',
              },
              {
                key: 'is_bestseller',
                label: 'Bestseller',
              },
              {
                key: 'is_trending',
                label: 'Trending',
              },
              {
                key: 'is_new',
                label: 'New Arrival',
              },
              {
                key: 'is_active',
                label: 'Active',
              },
            ] as const).map((flag) => (

              <label
                key={flag.key}

                className="flex cursor-pointer items-center gap-2 rounded-xl border border-ink-200 px-3 py-2"
              >

                <input
                  type="checkbox"

                  checked={form[flag.key]}

                  onChange={(e) =>
                    setForm({
                      ...form,
                      [flag.key]:
                        e.target.checked,
                    })
                  }

                  className="h-4 w-4 rounded text-primary-600"
                />


                <span className="text-sm font-medium text-ink-700">

                  {flag.label}

                </span>

              </label>

            ))}

          </div>


          {/* BUTTONS */}

          <div className="flex gap-3 pt-2">

            <Button
              variant="outline"

              onClick={() =>
                setShowModal(false)
              }

              className="flex-1"
            >

              Cancel

            </Button>


            <Button
              onClick={handleSave}

              loading={saving}

              className="flex-1"
            >

              {editing
                ? 'Update Product'
                : 'Add Product'}

            </Button>

          </div>

        </div>

      </Modal>


      {/* DELETE CONFIRMATION */}

      <ConfirmDialog
        open={!!deleteId}

        onClose={() =>
          setDeleteId(null)
        }

        onConfirm={handleDelete}

        title="Delete Product"

        message="Are you sure you want to delete this product?"

        confirmLabel="Delete"

        danger
      />

    </div>
  );
}