import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchShippingConfig } from '@/services/api';
import type { ShippingConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { formatINR } from '@/utils/format';
import { Truck, Save } from 'lucide-react';

export function AdminShipping() {
  const { toast } = useToast();
  const [config, setConfig] = useState<ShippingConfig | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => { fetchShippingConfig().then(setConfig); }, []);

  async function handleSave() {
    if (!config) return;
    if (config.shipping_fee < 0 || config.free_shipping_threshold < 0) { toast('Values cannot be negative', 'error'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({
        key: 'shipping',
        value: config as unknown as Record<string, unknown>,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await supabase.rpc('log_admin_action', { p_action: 'Shipping Updated', p_target: 'site_settings', p_target_id: 'shipping' });
      toast('Shipping settings saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (!config) return <div className="h-48 rounded-2xl bg-ink-100 animate-shimmer" />;

  return (
    <div className="max-w-lg space-y-4">
      <h1 className="text-lg font-bold text-ink-900 sm:text-xl flex items-center gap-2"><Truck className="h-5 w-5" /> Shipping Settings</h1>

      <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-4">
        <Input
          label="Shipping Fee (₹)"
          type="number"
          value={String(config.shipping_fee)}
          onChange={(e) => setConfig({ ...config, shipping_fee: Number(e.target.value) || 0 })}
          hint="Set to 0 for free shipping on all orders"
        />
        <Input
          label="Free Shipping Threshold (₹)"
          type="number"
          value={String(config.free_shipping_threshold)}
          onChange={(e) => setConfig({ ...config, free_shipping_threshold: Number(e.target.value) || 0 })}
          hint={config.free_shipping_threshold === 0 ? 'No minimum — free shipping on every order' : `Orders above ${formatINR(config.free_shipping_threshold)} get free shipping`}
        />
        <Input
          label="Display Message"
          value={config.message ?? ''}
          onChange={(e) => setConfig({ ...config, message: e.target.value })}
          placeholder="e.g. Free shipping on all orders"
        />
        <label className="flex items-center gap-2 cursor-pointer rounded-xl border border-ink-200 p-3">
          <input
            type="checkbox"
            checked={config.enabled}
            onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
            className="h-4 w-4 rounded text-primary-600"
          />
          <div>
            <p className="text-sm font-semibold text-ink-800">Enable Free Shipping</p>
            <p className="text-xs text-ink-500">When enabled with threshold 0, all orders get free shipping</p>
          </div>
        </label>

        <div className="rounded-xl bg-primary-50 p-3 text-xs text-primary-700">
          <p className="font-semibold">Current rule:</p>
          <p className="mt-1">
            {config.enabled
              ? config.free_shipping_threshold === 0
                ? `Free shipping on all orders — no minimum`
                : `Free shipping above ${formatINR(config.free_shipping_threshold)}, otherwise ${formatINR(config.shipping_fee)}`
              : `Flat ${formatINR(config.shipping_fee)} shipping on all orders`}
          </p>
        </div>

        <Button onClick={handleSave} loading={saving} className="w-full" size="lg"><Save className="h-4 w-4" /> Save Settings</Button>
      </div>
    </div>
  );
}
