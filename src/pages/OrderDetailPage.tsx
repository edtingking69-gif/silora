import { useEffect, useState } from 'react';
import { Link, navigate } from '@/components/router/Router';
import { useAuth } from '@/contexts/AuthContext';
import { fetchOrderById, fetchPaymentsByOrder, fetchOrderStatusHistory } from '@/services/api';
import type { Order, Payment, OrderStatusHistory, DeliveryStatus } from '@/types';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatINR, formatDateTime } from '@/utils/format';
import { ArrowLeft, Package, MapPin, CreditCard, Check, Truck, Clock, Info } from 'lucide-react';
import { classNames } from '@/utils/format';

const DELIVERY_STEPS: DeliveryStatus[] = ['Pending', 'Confirmed', 'Processing', 'Packed', 'Shipped', 'Out for Delivery', 'Delivered'];

export function OrderDetailPage({ id }: { id: string }) {
  const { user } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [history, setHistory] = useState<OrderStatusHistory[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate('/login'); return; }
    async function load() {
      const o = await fetchOrderById(id, user!.id);
      setOrder(o);
      if (o) {
        const [pays, hist] = await Promise.all([fetchPaymentsByOrder(o.id), fetchOrderStatusHistory(o.id)]);
        setPayments(pays);
        setHistory(hist);
      }
      setLoading(false);
    }
    load();
  }, [id, user]);

  if (loading) return <div className="container-silora py-6"><div className="h-64 rounded-2xl bg-ink-100 animate-shimmer" /></div>;

  if (!order)
    return (
      <div className="container-silora py-6">
        <EmptyState icon={<Package className="h-8 w-8" />} title="Order not found" message="This order doesn't exist or you don't have access to it." action={<Link to="/account/orders" className="rounded-xl bg-primary-600 px-5 py-2.5 text-sm font-semibold text-white">View Orders</Link>} />
      </div>
    );

  const currentStepIdx = DELIVERY_STEPS.indexOf(order.delivery_status);
  const isCancelled = order.delivery_status === 'Cancelled' || order.delivery_status === 'Returned';
  const isAwaitingVerification = order.payment_status === 'Payment Submitted' || order.payment_status === 'Under Verification' || order.payment_status === 'Pending';

  return (
    <div className="container-silora py-6">
      <Link to="/account/orders" className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-primary-600">
        <ArrowLeft className="h-4 w-4" /> Back to Orders
      </Link>

      <div className="mb-5 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-ink-900 sm:text-2xl">Order #{order.order_number}</h1>
          <p className="text-sm text-ink-500">Placed on {formatDateTime(order.created_at)}</p>
        </div>
        <div className="flex gap-2">
          <span className={classNames(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold',
            order.payment_status === 'Paid' ? 'bg-success-100 text-success-700' :
            order.payment_status === 'Failed' || order.payment_status === 'Cancelled' ? 'bg-error-100 text-error-700' :
            'bg-warning-100 text-warning-700'
          )}>
            {order.payment_status === 'Payment Submitted' ? 'Payment Submitted — Awaiting Verification' : order.payment_status}
          </span>
          <span className={classNames(
            'inline-flex items-center rounded-full px-3 py-1 text-xs font-bold',
            order.delivery_status === 'Delivered' ? 'bg-success-100 text-success-700' :
            isCancelled ? 'bg-error-100 text-error-700' : 'bg-accent-100 text-accent-700'
          )}>{order.delivery_status}</span>
        </div>
      </div>

      {/* Payment Verification Notice */}
      {isAwaitingVerification && order.payment_status !== 'Paid' && (
        <div className="mb-6 rounded-2xl border border-accent-200 bg-accent-50/80 p-4 sm:p-5">
          <div className="flex items-center gap-2 text-accent-900 font-bold text-sm">
            <Info className="h-4 w-4 text-accent-700 shrink-0" />
            Payment Verification Notice
          </div>
          <p className="mt-2 text-xs text-accent-900 leading-relaxed sm:text-sm">
            Thank you for your payment. Payments are manually verified by our team between 6:00 PM and 10:00 PM. Your order will be confirmed once the payment has been successfully verified. We appreciate your patience and understanding.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-5">
          {/* Delivery timeline */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 mb-4">
              <Truck className="h-5 w-5 text-primary-600" /> Delivery Status
            </h2>
            {isCancelled ? (
              <div className="rounded-xl bg-error-50 p-4 text-center">
                <p className="font-bold text-error-700">{order.delivery_status}</p>
                {order.delivery_notes && <p className="mt-1 text-sm text-error-600">{order.delivery_notes}</p>}
              </div>
            ) : (
              <div className="relative">
                {DELIVERY_STEPS.map((status, i) => {
                  const done = i <= currentStepIdx;
                  const isCurrent = i === currentStepIdx;
                  const histEntry = history.find((h) => h.new_status === status);
                  return (
                    <div key={status} className="flex gap-3 pb-5 last:pb-0">
                      <div className="flex flex-col items-center">
                        <div className={classNames(
                          'flex h-8 w-8 items-center justify-center rounded-full transition-colors',
                          done ? 'bg-primary-600 text-white' : 'bg-ink-100 text-ink-400',
                          isCurrent && 'ring-4 ring-primary-100'
                        )}>
                          {done ? <Check className="h-4 w-4" /> : <Clock className="h-4 w-4" />}
                        </div>
                        {i < DELIVERY_STEPS.length - 1 && (
                          <div className={classNames('mt-1 w-0.5 flex-1', i < currentStepIdx ? 'bg-primary-600' : 'bg-ink-200')} style={{ minHeight: 20 }} />
                        )}
                      </div>
                      <div className="pt-1">
                        <p className={classNames('text-sm font-semibold', done ? 'text-ink-900' : 'text-ink-400')}>{status}</p>
                        {histEntry && <p className="text-xs text-ink-400">{formatDateTime(histEntry.created_at)}</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            {order.tracking_number && (
              <div className="mt-4 rounded-xl bg-accent-50 p-3 text-sm">
                <p className="font-semibold text-ink-900">Tracking: {order.tracking_number}</p>
                {order.courier && <p className="text-ink-600">Courier: {order.courier}</p>}
              </div>
            )}
          </div>

          {/* Items */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-base font-bold text-ink-900 mb-4">Items</h2>
            <div className="space-y-3">
              {order.order_items?.map((item) => (
                <div key={item.id} className="flex gap-3">
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-ink-100">
                    {item.product_image && <img src={item.product_image} alt={item.product_name} className="h-full w-full object-cover" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-ink-900">{item.product_name}</p>
                    {item.variant_name && <p className="text-xs text-ink-500">{item.variant_name}</p>}
                    <p className="text-xs text-ink-500">Qty: {item.quantity} × {formatINR(item.price)}</p>
                  </div>
                  <span className="text-sm font-bold text-ink-900">{formatINR(Number(item.price) * item.quantity)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-5">
          {/* Summary */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="text-base font-bold text-ink-900 mb-3">Payment Summary</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-ink-600">Subtotal</span><span className="font-semibold">{formatINR(order.subtotal)}</span></div>
              {Number(order.discount) > 0 && <div className="flex justify-between text-success-600"><span>Discount</span><span className="font-semibold">-{formatINR(order.discount)}</span></div>}
              <div className="flex justify-between"><span className="text-ink-600">Shipping</span><span className="font-semibold">{Number(order.shipping) === 0 ? 'FREE' : formatINR(order.shipping)}</span></div>
              <div className="border-t border-ink-100 pt-2 flex justify-between"><span className="font-bold text-ink-900">Total</span><span className="text-lg font-extrabold text-primary-600">{formatINR(order.total)}</span></div>
            </div>
          </div>

          {/* Payment info */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 mb-3">
              <CreditCard className="h-5 w-5 text-primary-600" /> Payment
            </h2>
            <p className="text-sm text-ink-600">Method: <span className="font-semibold text-ink-900">{order.payment_method_name ?? 'UPI / QR'}</span></p>
            <p className="text-sm text-ink-600 mt-1">Status: <span className="font-semibold">{order.payment_status === 'Payment Submitted' ? 'Payment Submitted — Awaiting Verification' : order.payment_status}</span></p>
            {payments.length > 0 && payments[0].payment_reference && (
              <p className="text-sm text-ink-600 mt-1">Reference / UTR: <span className="font-mono text-xs font-bold">{payments[0].payment_reference}</span></p>
            )}
          </div>

          {/* Address */}
          <div className="rounded-2xl border border-ink-100 bg-white p-5">
            <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 mb-3">
              <MapPin className="h-5 w-5 text-primary-600" /> Delivery Address
            </h2>
            <p className="text-sm font-semibold text-ink-900">{order.customer_name}</p>
            {order.mobile && <p className="text-sm text-ink-600">{order.mobile}</p>}
            <p className="text-sm text-ink-600">{order.address_line1}{order.address_line2 ? `, ${order.address_line2}` : ''}</p>
            <p className="text-sm text-ink-600">{order.city}, {order.state} - {order.pincode}</p>
          </div>
        </div>
      </div>
    </div>
  );
}