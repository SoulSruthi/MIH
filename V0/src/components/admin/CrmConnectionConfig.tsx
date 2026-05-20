'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import { CheckCircle2, AlertCircle, Info, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

// ─── Types ────────────────────────────────────────────────────────────────────

type CrmConfig = {
  crm_org_id: string;
  base_url: string;
  bearer_token: string;
  hmac_secret: string;
};

type ToastState = { type: 'success' | 'error'; message: string } | null;

// ─── Toast ────────────────────────────────────────────────────────────────────

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center gap-2 rounded-md border px-4 py-3 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800',
      ].join(' ')}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      )}
      {toast.message}
    </div>
  );
}

// ─── Field ────────────────────────────────────────────────────────────────────

type FieldProps = {
  label: string;
  id: string;
  type?: string;
  value: string;
  placeholder?: string;
  tooltip?: string;
  onChange: (v: string) => void;
};

function Field({ label, id, type = 'text', value, placeholder, tooltip, onChange }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
        {label}
        {tooltip && (
          <span className="group relative cursor-help">
            <Info className="h-3.5 w-3.5 text-slate-400" />
            <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 w-56 rounded-md bg-slate-800 px-2.5 py-1.5 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100 z-10">
              {tooltip}
            </span>
          </span>
        )}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        autoComplete={type === 'password' ? 'new-password' : undefined}
      />
    </div>
  );
}

// ─── CrmConnectionConfig ──────────────────────────────────────────────────────

export function CrmConnectionConfig() {
  const uid = useId();

  const [form, setForm] = useState<CrmConfig>({
    crm_org_id: '',
    base_url: '',
    bearer_token: '',
    hmac_secret: '',
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((type: 'success' | 'error', message: string) => {
    setToast({ type, message });
  }, []);

  // Load existing config on mount
  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const res = await fetch('/api/admin/crm-connection', {
          headers: { 'x-org-id': 'demo-org-id' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as CrmConfig;
        if (!cancelled) {
          setForm({
            crm_org_id: data.crm_org_id ?? '',
            base_url: data.base_url ?? '',
            bearer_token: data.bearer_token ?? '',
            hmac_secret: data.hmac_secret ?? '',
          });
        }
      } catch {
        // No existing config — start fresh
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, []);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/crm-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify(form),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error ?? `HTTP ${res.status}`);
      showToast('success', 'CRM connection saved successfully.');
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Failed to save CRM connection.');
    } finally {
      setSaving(false);
    }
  }, [form, showToast]);

  const handleTestPing = useCallback(async () => {
    setTesting(true);
    try {
      const res = await fetch('/api/admin/crm-connection/test', {
        method: 'POST',
        headers: { 'x-org-id': 'demo-org-id' },
      });
      const json = (await res.json()) as { ok: boolean; status?: number; error?: string };
      if (json.ok) {
        showToast('success', `Ping successful — CRM responded with HTTP ${json.status ?? 200}.`);
      } else {
        showToast('error', json.error ?? `Ping failed (HTTP ${json.status ?? 'unknown'})`);
      }
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : 'Test ping failed.');
    } finally {
      setTesting(false);
    }
  }, [showToast]);

  const setField = useCallback((key: keyof CrmConfig) => (value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  if (loading) {
    return <div className="py-16 text-center text-sm text-slate-500">Loading CRM config…</div>;
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {toast && <Toast toast={toast} onDismiss={() => setToast(null)} />}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">CRM Connection Settings</CardTitle>
          <CardDescription>
            Configure the connection to your CRM system. The HMAC secret is used to verify inbound
            lifecycle webhooks from the CRM.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <Field
            label="CRM Org ID"
            id={`${uid}-crm-org-id`}
            value={form.crm_org_id}
            placeholder="your-crm-org-id"
            onChange={setField('crm_org_id')}
          />
          <Field
            label="Base URL"
            id={`${uid}-base-url`}
            value={form.base_url}
            placeholder="https://your-crm.example.com"
            onChange={setField('base_url')}
          />
          <Field
            label="Bearer Token"
            id={`${uid}-bearer-token`}
            type="password"
            value={form.bearer_token}
            placeholder="••••••••"
            onChange={setField('bearer_token')}
          />
          <Field
            label="HMAC Secret"
            id={`${uid}-hmac-secret`}
            type="password"
            value={form.hmac_secret}
            placeholder="••••••••"
            tooltip="Used to verify inbound webhooks from your CRM via HMAC-SHA256 signature."
            onChange={setField('hmac_secret')}
          />

          <div className="flex items-center gap-3 pt-2">
            <Button onClick={() => void handleSave()} disabled={saving} className="min-w-24">
              {saving ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Saving…
                </>
              ) : (
                'Save'
              )}
            </Button>
            <Button
              variant="outline"
              onClick={() => void handleTestPing()}
              disabled={testing || !form.base_url}
            >
              {testing ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Testing…
                </>
              ) : (
                'Test Ping'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
