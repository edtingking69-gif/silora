import { useEffect, useState } from 'react';
import { Link } from '@/components/router/Router';
import { supabase } from '@/lib/supabase';
import type { RevenueSummary, RevenuePoint, RevenueBreakdown } from '@/types';
import { formatINR, classNames } from '@/utils/format';
import { Skeleton } from '@/components/ui/Skeleton';
import { TrendingUp, TrendingDown, ShoppingBag, DollarSign, Package, Users, AlertTriangle, Clock } from 'lucide-react';

export function AdminDashboard() {
  const [summary, setSummary] = useState<RevenueSummary | null>(null);
  const [chartData, setChartData] = useState<RevenuePoint[]>([]);
  const [chartRange, setChartRange] = useState<'7' | '30' | '12'>('7');
  const [byMethod, setByMethod] = useState<RevenueBreakdown[]>([]);
  const [byCategory, setByCategory] = useState<RevenueBreakdown[]>([]);
  const [stats, setStats] = useState({ products: 0, lowStock: 0, customers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [sumRes, prodRes, custRes] = await Promise.all([
        supabase.rpc('admin_revenue_summary'),
        supabase.from('products').select('id, stock', { count: 'exact' }),
        supabase.from('profiles').select('id', { count: 'exact' }),
      ]);
      setSummary(sumRes.data as RevenueSummary);
      const products = (prodRes.data as { id: string; stock: number }[]) ?? [];
      setStats({
        products: prodRes.count ?? 0,
        lowStock: products.filter((p) => p.stock <= 5).length,
        customers: custRes.count ?? 0,
      });
      setLoading(false);
    }
    load();
  }, []);

  useEffect(() => {
    async function loadCharts() {
      if (chartRange === '12') {
        const { data } = await supabase.rpc('admin_revenue_by_month', { p_months: 12 });
        setChartData((data as RevenuePoint[]) ?? []);
      } else {
        const { data } = await supabase.rpc('admin_revenue_by_day', { p_days: Number(chartRange) });
        setChartData((data as RevenuePoint[]) ?? []);
      }
      const [m, c] = await Promise.all([
        supabase.rpc('admin_revenue_by_method'),
        supabase.rpc('admin_revenue_by_category'),
      ]);
      setByMethod((m.data as RevenueBreakdown[]) ?? []);
      setByCategory((c.data as RevenueBreakdown[]) ?? []);
    }
    loadCharts();
  }, [chartRange]);

  if (loading || !summary) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
        </div>
        <Skeleton className="h-64 rounded-2xl" />
      </div>
    );
  }

  const cards = [
    { label: 'Total Revenue', value: formatINR(summary.total), icon: DollarSign, color: 'text-primary-600 bg-primary-50' },
    { label: "Today's Revenue", value: formatINR(summary.today), icon: TrendingUp, color: 'text-success-600 bg-success-50' },
    { label: 'This Week', value: formatINR(summary.week), icon: TrendingUp, color: 'text-accent-600 bg-accent-50' },
    { label: 'This Month', value: formatINR(summary.month), icon: TrendingUp, color: 'text-primary-600 bg-primary-50' },
    { label: 'Total Orders', value: summary.total_orders, icon: ShoppingBag, color: 'text-ink-700 bg-ink-100' },
    { label: 'Paid Orders', value: summary.paid_orders, icon: ShoppingBag, color: 'text-success-600 bg-success-50' },
    { label: 'Pending Payments', value: summary.pending_payments, icon: Clock, color: 'text-warning-600 bg-warning-50' },
    { label: 'Total Products', value: stats.products, icon: Package, color: 'text-ink-700 bg-ink-100' },
    { label: 'Low Stock', value: stats.lowStock, icon: AlertTriangle, color: 'text-warning-600 bg-warning-50' },
    { label: 'Customers', value: stats.customers, icon: Users, color: 'text-accent-600 bg-accent-50' },
  ];

  const maxRevenue = Math.max(...chartData.map((d) => Number(d.revenue)), 1);

  return (
    <div className="space-y-5">
      {/* Revenue cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="rounded-2xl border border-ink-100 bg-white p-4">
            <div className={classNames('mb-3 flex h-9 w-9 items-center justify-center rounded-lg', card.color)}>
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-xs font-medium text-ink-500">{card.label}</p>
            <p className="mt-1 text-lg font-extrabold text-ink-900 sm:text-xl">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Revenue analytics row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs text-ink-500">Average Order Value</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatINR(summary.aov)}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="text-xs text-ink-500">Gross Revenue</p>
          <p className="mt-1 text-xl font-bold text-ink-900">{formatINR(summary.total)}</p>
        </div>
        <div className="rounded-2xl border border-ink-100 bg-white p-4">
          <p className="flex items-center gap-1 text-xs text-ink-500"><TrendingDown className="h-3 w-3" /> Refunds</p>
          <p className="mt-1 text-xl font-bold text-error-600">{formatINR(summary.refunds)}</p>
        </div>
      </div>

      {/* Revenue chart */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <h2 className="text-base font-bold text-ink-900">Revenue Trend</h2>
          <div className="flex gap-1 rounded-lg bg-ink-100 p-1">
            {(['7', '30', '12'] as const).map((r) => (
              <button
                key={r}
                onClick={() => setChartRange(r)}
                className={classNames(
                  'rounded-md px-3 py-1.5 text-xs font-semibold transition-colors',
                  chartRange === r ? 'bg-white text-primary-700 shadow-sm' : 'text-ink-600',
                )}
              >
                {r === '12' ? '12 Months' : `${r} Days`}
              </button>
            ))}
          </div>
        </div>
        {chartData.length === 0 ? (
          <p className="py-12 text-center text-sm text-ink-500">No revenue data yet</p>
        ) : (
          <div className="flex items-end gap-1 sm:gap-2 h-48 overflow-x-auto">
            {chartData.map((point, i) => {
              const height = (Number(point.revenue) / maxRevenue) * 100;
              const label = point.day ? new Date(point.day).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : point.label ?? point.month;
              return (
                <div key={i} className="flex flex-1 flex-col items-center gap-1.5 min-w-[30px]">
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-primary-600 to-primary-400 transition-all hover:from-primary-700 hover:to-primary-500"
                      style={{ height: `${Math.max(height, 2)}%` }}
                      title={formatINR(point.revenue)}
                    />
                  </div>
                  <span className="text-[10px] text-ink-500 whitespace-nowrap">{label}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Breakdowns */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-base font-bold text-ink-900 mb-4">Revenue by Payment Method</h2>
          {byMethod.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              {byMethod.map((item) => {
                const max = Math.max(...byMethod.map((m) => Number(m.revenue)), 1);
                return (
                  <div key={item.method}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink-700">{item.method}</span>
                      <span className="font-bold text-ink-900">{formatINR(item.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-primary-500" style={{ width: `${(Number(item.revenue) / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-ink-100 bg-white p-5">
          <h2 className="text-base font-bold text-ink-900 mb-4">Revenue by Category</h2>
          {byCategory.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-500">No data yet</p>
          ) : (
            <div className="space-y-3">
              {byCategory.map((item) => {
                const max = Math.max(...byCategory.map((m) => Number(m.revenue)), 1);
                return (
                  <div key={item.category}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium text-ink-700">{item.category}</span>
                      <span className="font-bold text-ink-900">{formatINR(item.revenue)}</span>
                    </div>
                    <div className="h-2 rounded-full bg-ink-100">
                      <div className="h-full rounded-full bg-accent-500" style={{ width: `${(Number(item.revenue) / max) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'Orders', path: '/admin/orders', icon: ShoppingBag },
          { label: 'Products', path: '/admin/products', icon: Package },
          { label: 'Customers', path: '/admin/customers', icon: Users },
          { label: 'Payments', path: '/admin/payments', icon: DollarSign },
        ].map((link) => (
          <Link key={link.path} to={link.path} className="flex items-center gap-3 rounded-2xl border border-ink-100 bg-white p-4 hover:shadow-card-hover transition-all">
            <link.icon className="h-5 w-5 text-primary-600" />
            <span className="text-sm font-semibold text-ink-900">{link.label}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
