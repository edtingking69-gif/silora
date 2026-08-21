import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchAdminPayments, fetchPaymentStatusHistory } from '@/services/api';
import type { Payment, PaymentStatusHistory, PaymentStatus } from '@/types';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/EmptyState';
import { useToast } from '@/contexts/ToastContext';
import { formatINR, formatDateTime, classNames } from '@/utils/format';
import { CreditCard, Search, Check, X, Clock, RotateCcw } from 'lucide-react';

const PAYMENT_STATUSES: PaymentStatus[] = ['Pending', 'Payment Submitted', 'Under Verification', 'Paid', 'Failed', 'Refunded', 'Cancelled'];

export function AdminPayments() {
  const { toast } = useToast();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<Payment | null>(null);
  const [history, setHistory] = useState<PaymentStatusHistory[]>([]);

  async function load() {
    setLoading(true);
    const p = await fetchAdminPayments();
    setPayments(p);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openPayment(p: Payment) {
    setSelected(p);
    const h = await fetchPaymentStatusHistory(p.id);
    setHistory(h);
  }

  async function handleUpdate(paymentId: string, status: PaymentStatus) {
    try {
      const { error } = await supabase.rpc('update_payment_status', { p_payment_id: paymentId, p_new_status: status });
      if (error) throw error;
      toast(`Payment marked as ${status}`);
      if (selected) { await openPayment(selected); load(); }
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Update failed', 'error');
    }
  }

  const filtered = payments.filter((p) => {
    if (filter && p.status !== filter) return false;
    if (search && !p.payment_method_name?.toLowerCase().includes(search.toLowerCase()) && !p.id.includes(search)) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Payments ({payments.length})</h1>

      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." className="h-10 w-full rounded-xl border border-ink-300 bg-white pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500/30" />
        </div>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="h-10 rounded-xl border border-ink-300 bg-white px-3 text-sm">
          <option value="">All Statuses</option>
          {PAYMENT_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-2xl bg-ink-100 animate-shimmer" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={<CreditCard className="h-8 w-8" />} title="No payments" message="Payment records will appear here." />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <button key={p.id} onClick={() => openPayment(p)} className="w-full text-left rounded-2xl border border-ink-100 bg-white p-4 hover:shadow-card-hover transition-all">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-bold text-ink-900">{formatINR(p.amount)}</p>
                  <p className="text-xs text-ink-500">{p.payment_method_name} · {formatDateTime(p.created_at)}</p>
                </div>
                <Badge variant={p.status === 'Paid' ? 'success' : p.status === 'Failed' || p.status === 'Cancelled' ? 'error' : p.status === 'Refunded' ? 'warning' : 'info'}>{p.status}</Badge>
              </div>
              {p.payment_reference && <p className="mt-1.5 text-xs text-ink-600">Ref: <span className="font-mono">{p.payment_reference}</span></p>}
            </button>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title="Payment Details">
        {selected && (
          <div className="space-y-4">
            <div className="rounded-xl bg-ink-50 p-4 space-y-1.5 text-sm">
              <div className="flex justify-between"><span className="text-ink-600">Amount</span><span className="font-bold text-ink-900">{formatINR(selected.amount)}</span></div>
              <div className="flex justify-between"><span className="text-ink-600">Method</span><span className="font-semibold">{selected.payment_method_name}</span></div>
              <div className="flex justify-between"><span className="text-ink-600">Status</span><Badge variant={selected.status === 'Paid' ? 'success' : selected.status === 'Failed' || selected.status === 'Cancelled' ? 'error' : 'warning'}>{selected.status}</Badge></div>
              {selected.payment_reference && <div className="flex justify-between"><span className="text-ink-600">Reference</span><span className="font-mono text-xs">{selected.payment_reference}</span></div>}
              {selected.submitted_at && <div className="flex justify-between"><span className="text-ink-600">Submitted</span><span>{formatDateTime(selected.submitted_at)}</span></div>}
              {selected.verified_at && <div className="flex justify-between"><span className="text-ink-600">Verified</span><span>{formatDateTime(selected.verified_at)}</span></div>}
            </div>

            {selected.status !== 'Paid' && selected.status !== 'Cancelled' && (
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="success" onClick={() => handleUpdate(selected.id, 'Paid')}><Check className="h-3.5 w-3.5" /> Mark Paid</Button>
                <Button size="sm" variant="outline" onClick={() => handleUpdate(selected.id, 'Under Verification')}><Clock className="h-3.5 w-3.5" /> Under Verification</Button>
                <Button size="sm" variant="danger" onClick={() => handleUpdate(selected.id, 'Failed')}><X className="h-3.5 w-3.5" /> Mark Failed</Button>
              </div>
            )}
            {selected.status === 'Paid' && (
              <Button size="sm" variant="outline" onClick={() => handleUpdate(selected.id, 'Refunded')}><RotateCcw className="h-3.5 w-3.5" /> Issue Refund</Button>
            )}

            {history.length > 0 && (
              <div>
                <p className="text-xs font-bold text-ink-700 mb-2">Status History</p>
                <div className="space-y-1.5">
                  {history.map((h) => (
                    <div key={h.id} className="flex items-center gap-2 text-xs">
                      <Clock className="h-3 w-3 text-primary-500" />
                      <span className="font-medium text-ink-700">{h.new_status}</span>
                      <span className="text-ink-400">— {formatDateTime(h.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
