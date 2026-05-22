'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ORG_ID = 'demo-org-id';

type ChannelPartner = {
  id: string;
  name: string;
  code: string | null;
  cp_type: string;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  default_commission_pct: number;
};

type CreateFormState = {
  name: string;
  code: string;
  cp_type: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  default_commission_pct: string;
  rera_number: string;
};

const DEFAULT_FORM: CreateFormState = {
  name: '',
  code: '',
  cp_type: 'individual',
  contact_name: '',
  contact_email: '',
  contact_phone: '',
  default_commission_pct: '0.025',
  rera_number: '',
};

export function ChannelPartnersDashboard() {
  const [cps, setCps] = useState<ChannelPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchCPs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/channel-partners', { headers: { 'x-org-id': ORG_ID } });
      if (!res.ok) { setError(`Failed to load channel partners (HTTP ${res.status}).`); return; }
      const d = (await res.json()) as { channel_partners: ChannelPartner[] };
      setCps(d.channel_partners ?? []);
    } catch {
      setError('Failed to load channel partners.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchCPs(); }, [fetchCPs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        cp_type: form.cp_type,
        default_commission_pct: parseFloat(form.default_commission_pct),
      };
      if (form.code) body.code = form.code;
      if (form.contact_name) body.contact_name = form.contact_name;
      if (form.contact_email) body.contact_email = form.contact_email;
      if (form.contact_phone) body.contact_phone = form.contact_phone;
      if (form.rera_number) body.rera_number = form.rera_number;

      const res = await fetch('/api/channel-partners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create channel partner.');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchCPs();
    } catch {
      setCreateError('Failed to create channel partner.');
    } finally {
      setCreating(false);
    }
  };

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${cps.length} partner${cps.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setCreateError(null); }}>
          {showForm ? 'Cancel' : 'Onboard Partner'}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">New Channel Partner</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  { label: 'Name *', key: 'name', required: true, placeholder: 'e.g. Rajesh Realty' },
                  { label: 'Code', key: 'code', placeholder: 'e.g. RR001' },
                  { label: 'Contact Name', key: 'contact_name', placeholder: 'John Doe' },
                  { label: 'Contact Email', key: 'contact_email', placeholder: 'broker@example.com' },
                  { label: 'Contact Phone', key: 'contact_phone', placeholder: '+91 9876543210' },
                  { label: 'RERA Number', key: 'rera_number', placeholder: 'RERA/MH/12345' },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">{field.label}</label>
                    <input
                      type="text"
                      required={field.required}
                      value={form[field.key as keyof CreateFormState]}
                      onChange={(e) => setForm((f) => ({ ...f, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Type</label>
                  <select
                    value={form.cp_type}
                    onChange={(e) => setForm((f) => ({ ...f, cp_type: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="individual">Individual</option>
                    <option value="firm">Firm</option>
                    <option value="sub_broker">Sub-Broker</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Default Commission %</label>
                  <input
                    type="number" min="0" max="1" step="0.001"
                    value={form.default_commission_pct}
                    onChange={(e) => setForm((f) => ({ ...f, default_commission_pct: e.target.value }))}
                    placeholder="0.025"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Onboard'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-28 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : cps.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No channel partners yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cps.map((cp) => (
            <Link key={cp.id} href={`/channel-partners/${cp.id}`}>
              <Card className="rounded-xl shadow-sm border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-slate-900">{cp.name}</p>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-semibold border ${cp.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                      {cp.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {cp.code && <p className="text-xs text-slate-500">{cp.code}</p>}
                  <p className="text-xs text-slate-500 capitalize">{cp.cp_type.replace('_', ' ')}</p>
                  <p className="text-sm font-medium text-slate-700">
                    Commission: {(cp.default_commission_pct * 100).toFixed(2)}%
                  </p>
                  {cp.contact_email && <p className="text-xs text-slate-400">{cp.contact_email}</p>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
