import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminOrders, fetchAdminOrderById, fetchOrderStatusHistory, fetchPaymentsByOrder } from '@/services/api';
import type { Order, OrderStatusHistory, Payment, DeliveryStatus, PaymentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, formatDate, formatDateTime } from '@/utils/format';
import { ShoppingCart, Search, Phone, Mail, MapPin, Truck, Check, X, Clock } from 'lucide-react';

const DELIVERY_STATUSES: DeliveryStatus[] = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Payment Submitted', 'Under Verification', 'Paid', 'Failed', 'Refunded', 'Cancelled'];

export function AdminOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDelivery, setFilterDelivery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>('Pending');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);

  async function load() {
    setLoading(true);
    const o = await fetchAdminOrders();
    setOrders(o);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openOrder(order: Order) {
    setSelected(order);
    setNewStatus(order.delivery_status);
    setCourier(order.courier ?? '');
    setTracking(order.tracking_number ?? '');
    setNote('');
    const [hist, pays] = await Promise.all([
      fetchOrderStatusHistory(order.id),
      fetchPaymentsByOrder(order.id),
    ]);
    setHistory(hist);
    setPayments(pays);
  }

  async function handleUpdateStatus() {
    if (!selected || !newStatus) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_status: newStatus,
          courier: courier || null,
          tracking_number: tracking || null,
          delivery_notes: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq<dyad-write path="src/pages/admin/AdminOrders.tsx" description="Complete and clean AdminOrders component with full payment verification and delivery status management">
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminOrders, fetchAdminOrderById, fetchOrderStatusHistory, fetchPaymentsByOrder } from '@/services/api';
import type { Order, OrderStatusHistory, Payment, DeliveryStatus, PaymentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Input, Select } from '@/components/ui/Input';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, formatDate, formatDateTime } from '@/utils/format';
import { ShoppingCart, Search, Phone, Mail, MapPin, Truck, Check, X, Clock } from 'lucide-react';

const DELIVERY_STATUSES: DeliveryStatus[] = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered', 'Cancelled', 'Returned'];
const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Payment Submitted', 'Under Verification', 'Paid', 'Failed', 'Refunded', 'Cancelled'];

export function AdminOrders() {
  const { toast } = useToast();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterPayment, setFilterPayment] = useState('');
  const [filterDelivery, setFilterDelivery] = useState('');
  const [selected, setSelected] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [newStatus, setNewStatus] = useState<DeliveryStatus>('Pending');
  const [courier, setCourier] = useState('');
  const [tracking, setTracking] = useState('');
  const [note, setNote] = useState('');
  const [updating, setUpdating] = useState(false);

  async function load() {
    setLoading(true);
    const o = await fetchAdminOrders();
    setOrders(o);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function openOrder(order: Order) {
    setSelected(order);
    setNewStatus(order.delivery_status);
    setCourier(order.courier ?? '');
    setTracking(order.tracking_number ?? '');
    setNote('');
    const [hist, pays] = await Promise.all([
      fetchOrderStatusHistory(order.id),
      fetchPaymentsByOrder(order.id),
    ]);
    setHistory(hist);
    setPayments(pays);
  }

  async function handleUpdateStatus() {
    if (!selected || !newStatus) return;
    setUpdating(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({
          delivery_status: newStatus,
          courier: courier || null,
          tracking_number: tracking || null,
          delivery_notes: note || null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selected.id);
      if (error) throw error;

      await supabase.from('order_status_history').insert({
        order_id: selected.id,
        previous_status: selected.delivery_status,
        new_status: newStatus,
        note: note || 'Updated by admin',
      });

      toast('Delivery status updated');
      const updated = await fetchAdminOrderById(selected.id);
      if (updated) await openOrder(updated);
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setUpdating(false);
    }
  }

  async function handleUpdatePayment(paymentId: string, status: PaymentStatus) {
    try {
      await supabase
        .from('payments')
        .update({
          status,
          verified_at: status === 'Paid' ? new Date().toISOString() : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', paymentId);

      if (selected) {
        await supabase
          .from('orders')
          .update({
            payment_status: status,
            updated_at: new Date().toISOString(),
          })
          .eq('id', selected.id);
      }

      await supabase.from('payment_status_history').insert({
        payment_id: paymentId,
        previous_status: selected?.payment_status ?? 'Pending',
        new_status: status,
        note: `Payment marked as ${status} by admin (Verification Window: 6:00 PM - 10:00 PM)`,
      });

      toast(`Payment marked as ${status}`);
      if (selected) {
        const updated = await fetchAdminOrderById(selected.id);
        if (updated) await openOrder(updated);
      }
      load();
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Payment update failed', 'error');
    }
  }

  const filtered = orders.filter((o) => {
    if (search && !o.order_number.toLowerCase().includes(search.toLowerCase()) && !o.customer_name.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterPayment && o.payment_status !== filterPayment) return false;
    if (filterDelivery && o.delivery_status !== filterDelivery) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Orders ({orders.length})</h1>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order # or customer..."
            className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30"
          />
        </div>
        <select
          value={filterPayment}
          onChange={(e) => setFilterPayment(e.target.value)}
          className="h-10 rounded-xl border border-ink-300 bg-white px-3 text-sm"
        >
          <option value="">All Payments</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterDelivery}
          onChange={(e) => setFilterDelivery(e.target.value)}
          className="h-10 rounded-xl border border-ink-300 bg-white px-3 text-sm"
        >
          <option value="">All Delivery</option>
          {DELIVERY_STATUSES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-ink-100 animate-shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<ShoppingCart className="h-8 w-8" />}
          title="No orders"
          message="Orders will appear here when placed."
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => {
            const isAwaitingVerification = order.payment_status === 'Payment Submitted' || order.payment_status === 'Under Verification';
            return (
              <button
                key={order.id}
                onClick={() => openOrder(order)}
                className="w-full text-left rounded-2xl border border-ink-100 bg-white p-4 hover:shadow-card-hover transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-ink-900">#{order.order_number}</p>
                    <p className="text-xs text-ink-500">{formatDate(order.created_at)}</p>
                  </div>
                  <p className="text-base font-bold text-ink-900">{formatINR(order.total)}</p>
                </div>
                <div className="mt-2 flex items-center gap-1.5 flex-wrap">
                  <span className="text-xs text-ink-600">{order.customer_name}</span>
                  {order.mobile && (
                    <span className="flex items-center gap-0.5 text-xs text-ink-500">
                      <Phone className="h-3 w-3" />
                      {order.mobile}
                    </span>
                  )}
                </div>
                <div className="mt-2 flex gap-1.5 flex-wrap">
                  <Badge
                    variant={
                      order.payment_status === 'Paid'
                        ? 'success'
                        : order.payment_status === 'Failed' || order.payment_status === 'Cancelled'
                        ? 'error'
                        : isAwaitingVerification
                        ? 'warning'
                        : 'default'
                    }
                  >
                    {isAwaitingVerification ? 'Payment Submitted — Awaiting Verification' : order.payment_status}
                  </Badge>
                  <Badge
                    variant={
                      order.delivery_status === 'Delivered'
                        ? 'success'
                        : order.delivery_status === 'Cancelled' || order.delivery_status === 'Returned'
                        ? 'error'
                        : 'info'
                    }
                  >
                    {order.delivery_status}
                  </Badge>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Order detail modal */}
      <Modal
        open={!!selected}
        onClose={() => setSelected(null)}
        title={selected ? `Order #${selected.order_number}` : ''}
        className="max-w-2xl"
      >
        {selected && (
          <div className="space-y-4">
            {/* Customer info */}
            <div className="rounded-xl bg-ink-50 p-4">
              <h3 className="text-sm font-bold text-ink-900 mb-2">Customer</h3>
              <div className="space-y-1 text-sm text-ink-700">
                <p className="font-semibold">{selected.customer_name}</p>
                <p className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-ink-400" /> {selected.email}
                </p>
                {selected.mobile && (
                  <p className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-ink-400" /> {selected.mobile}
                  </p>
                )}
                <p className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-ink-400 mt-0.5" />
                  {selected.address_line1}
                  {selected.address_line2 ? `, ${selected.address_line2}` : ''}, {selected.city}, {selected.state} - {selected.pincode}
                </p>
              </div>
            </div>

            {/* Items */}
            <div>
              <h3 className="text-sm font-bold text-ink-900 mb-2">Items</h3>
              <div className="space-y-2">
                {selected.order_items?.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-xl border border-ink-100 p-2">
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                      {item.product_image && (
                        <img src={item.product_image} alt="" className="h-full w-full object-cover" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-ink-900 truncate">{item.product_name}</p>
                      {item.variant_name && <p className="text-xs text-ink-500">{item.variant_name}</p>}
                      <p className="text-xs text-ink-500">
                        Qty: {item.quantity} × {formatINR(item.price)}
                      </p>
                    </div>
                    <span className="text-sm font-bold">{formatINR(Number(item.price) * item.quantity)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl border border-ink-100 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-600">Subtotal</span>
                <span className="font-semibold">{formatINR(selected.subtotal)}</span>
              </div>
              {Number(selected.discount) > 0 && (
                <div className="flex justify-between text-success-600">
                  <span>Discount</span>
                  <span>-{formatINR(selected.discount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-ink-600">Shipping</span>
                <span>{Number(selected.shipping) === 0 ? 'FREE' : formatINR(selected.shipping)}</span>
              </div>
              <div className="flex justify-between border-t pt-1.5">
                <span className="font-bold">Total</span>
                <span className="font-bold text-primary-600">{formatINR(selected.total)}</span>
              </div>
            </div>

            {/* Payment Verification Box */}
            <div className="rounded-xl border border-ink-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-bold text-ink-900">Payment Verification</h3>
                <Badge
                  variant={
                    selected.payment_status === 'Paid'
                      ? 'success'
                      : selected.payment_status === 'Failed' || selected.payment_status === 'Cancelled'
                      ? 'error'
                      : 'warning'
                  }
                >
                  {selected.payment_status === 'Payment Submitted'
                    ? 'Payment Submitted — Awaiting Verification'
                    : selected.payment_status}
                </Badge>
              </div>
              <p className="text-xs text-ink-600">Method: {selected.payment_method_name ?? 'UPI / QR'}</p>
              {payments.length > 0 && payments[0].payment_reference && (
                <p className="mt-1 text-xs text-ink-700 font-medium">
                  Transaction Reference / UTR: <span className="font-mono font-bold">{payments[0].payment_reference}</span>
                </p>
              )}
              {payments.length > 0 && payments[0].submitted_at && (
                <p className="text-xs text-ink-500">Submitted at: {formatDateTime(payments[0].submitted_at)}</p>
              )}

              <div className="mt-3 rounded-lg bg-ink-50 p-2.5 text-xs text-ink-600">
                <Clock className="h-3.5 w-3.5 inline mr-1 text-primary-600" />
                Payments are verified daily between <strong>6:00 PM – 10:00 PM</strong>. Verify the transaction in your UPI/bank statement, then select <strong>Paid</strong> or <strong>Failed</strong>.
              </div>

              {payments.length > 0 && (
                <div className="mt-3 flex gap-2 flex-wrap">
                  {selected.payment_status !== 'Paid' && (
                    <Button size="sm" variant="success" onClick={() => handleUpdatePayment(payments[0].id, 'Paid')}>
                      <Check className="h-3.5 w-3.5 mr-1" /> Mark Paid
                    </Button>
                  )}
                  {selected.payment_status !== 'Failed' && (
                    <Button size="sm" variant="danger" onClick={() => handleUpdatePayment(payments[0].id, 'Failed')}>
                      <X className="h-3.5 w-3.5 mr-1" /> Mark Failed
                    </Button>
                  )}
                  {selected.payment_status !== 'Under Verification' && selected.payment_status !== 'Paid' && (
                    <Button size="sm" variant="outline" onClick={() => handleUpdatePayment(payments[0].id, 'Under Verification')}>
                      Under Verification
                    </Button>
                  )}
                </div>
              )}
            </div>

            {/* Delivery status update */}
            <div className="rounded-xl border border-ink-100 p-4">
              <h3 className="text-sm font-bold text-ink-900 mb-3">Delivery Management</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <Select
                  label="Status"
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value as DeliveryStatus)}
                >
                  {DELIVERY_STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
                <Input
                  label="Courier"
                  value={courier}
                  onChange={(e) => setCourier(e.target.value)}
                  placeholder="e.g. Delhivery"
                />
                <Input
                  label="Tracking Number"
                  value={tracking}
                  onChange={(e) => setTracking(e.target.value)}
                  placeholder="Tracking ID"
                />
                <Input
                  label="Note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Optional note"
                />
              </div>
              <Button onClick={handleUpdateStatus} loading={updating} size="sm" className="mt-3 w-full">
                Update Delivery Status
              </Button>

              {history.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-bold text-ink-700 mb-2">Status History</p>
                  <div className="space-y-1.5">
                    {history.map((h) => (
                      <div key={h.id} className="flex items-center gap-2 text-xs">
                        <Truck className="h-3 w-3 text-primary-500" />
                        <span className="font-medium text-ink-700">{h.new_status}</span>
                        <span className="text-ink-400">— {formatDateTime(h.created_at)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}