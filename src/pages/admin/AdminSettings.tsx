import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { fetchStoreConfig, fetchAdminAuditLogs } from '@/services/api';
import type { StoreConfig } from '@/types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, formatDateTime } from '@/utils/format';
import { Save, Store, History } from 'lucide-react';

export function AdminSettings() {
  const { toast } = useToast();
  const [store, setStore] = useState<StoreConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [logs, setLogs] = useState<{ id: string; action: string; target: string | null; target_id: string | null; created_at: string }[]>([]);

  useEffect(() => {
    fetchStoreConfig().then(setStore);
    fetchAdminAuditLogs(20).then(setLogs);
  }, []);

  async function handleSave() {
    if (!store) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('site_settings').upsert({
        key: 'store',
        value: store,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      await supabase.rpc('log_admin_action', { p_action: 'Settings Updated', p_target: 'site_settings', p_target_id: 'store' });
      toast('Store settings saved');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <h1 className="text-lg font-bold text-ink-900 sm:text-xl">Settings</h1>

      {/* Store settings */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5 space-y-4">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900"><Store className="h-5 w-5 text-primary-600" /> Store Information</h2>
        {store ? (
          <>
            <Input label="Store Name" value={store.name} onChange={(e) => setStore({ ...store, name: e.target.value })} />
            <Input label="Tagline" value={store.tagline} onChange={(e) => setStore({ ...store, tagline: e.target.value })} />
            <Input label="Support Email" type="email" value={store.support_email} onChange={(e) => setStore({ ...store, support_email: e.target.value })} />
            <Input label="Support Phone" value={store.support_phone} onChange={(e) => setStore({ ...store, support_phone: e.target.value })} />
            <Button onClick={handleSave} loading={saving} size="lg" className="w-full"><Save className="h-4 w-4" /> Save Settings</Button>
          </>
        ) : (
          <div className="h-40 animate-shimmer rounded-xl bg-ink-100" />
        )}
      </div>

      {/* Audit log */}
      <div className="rounded-2xl border border-ink-100 bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-bold text-ink-900 mb-3"><History className="h-5 w-5 text-primary-600" /> Recent Activity</h2>
        {logs.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-500">No activity logged yet</p>
        ) : (
          <div className="space-y-2">
            {logs.map((log) => (
              <div key={log.id} className="flex items-center justify-between rounded-xl border border-ink-100 p-2.5 text-sm">
                <div>
                  <p className="font-semibold text-ink-900">{log.action}</p>
                  {log.target && <p className="text-xs text-ink-500">{log.target}{log.target_id ? ` · ${log.target_id.slice(0, 8)}` : ''}</p>}
                </div>
                <span className="text-xs text-ink-400">{formatDateTime(log.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
