'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const ORG_ID = 'demo-org-id';

type Referrer = {
  id: string;
  name: string;
  referrer_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  consent_state: string;
  bookings_count: number;
  default_commission_pct: number;
  reward_preference: string;
  is_active: boolean;
};

const CONSENT_CLASSES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  opted_in: 'bg-emerald-50 text-emerald-700',
  opted_out: 'bg-slate-100 text-slate-500',
  revoked: 'bg-red-50 text-red-700',
};

type CreateFormState = {
  name: string;
  contact_email: string;
  contact_phone: string;
  default_commission_pct: string;
  reward_preference: string;
};

const DEFAULT_FORM: CreateFormState = {
  name: '',
  contact_email: '',
  contact_phone: '',
  default_commission_pct: '0.015',
  reward_preference: 'cash',
};

export function ReferralsDashboard() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchReferrers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/referrals', { headers: { 'x-org-id': ORG_ID } });
      if (!res.ok) { setError(`Failed to load referrers (HTTP ${res.status}).`); return; }
      const d = (await res.json()) as { referrers: Referrer[] };
      setReferrers(d.referrers ?? []);
    } catch {
      setError('Failed to load referrers.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchReferrers(); }, [fetchReferrers]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        name: form.name.trim(),
        default_commission_pct: parseFloat(form.default_commission_pct),
        reward_preference: form.reward_preference,
      };
      if (form.contact_email) body.contact_email = form.contact_email;
      if (form.contact_phone) body.contact_phone = form.contact_phone;

      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create referrer.');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchReferrers();
    } catch {
      setCreateError('Failed to create referrer.');
    } finally {
      setCreating(false);
    }
  };

  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${referrers.length} referrer${referrers.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setCreateError(null); }}>
          {showForm ? 'Cancel' : 'Add Referrer'}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">New Referrer</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Name *</label>
                  <input type="text" required value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="Customer name" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact Email</label>
                  <input type="email" value={form.contact_email} onChange={(e) => setForm((f) => ({ ...f, contact_email: e.target.value }))} placeholder="customer@example.com" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Contact Phone</label>
                  <input type="text" value={form.contact_phone} onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))} placeholder="+91 9876543210" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Commission % (decimal)</label>
                  <input type="number" min="0" max="1" step="0.001" value={form.default_commission_pct} onChange={(e) => setForm((f) => ({ ...f, default_commission_pct: e.target.value }))} placeholder="0.015" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Reward Preference</label>
                  <select value={form.reward_preference} onChange={(e) => setForm((f) => ({ ...f, reward_preference: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="cash">Cash</option>
                    <option value="voucher">Voucher</option>
                    <option value="white_goods">White Goods</option>
                    <option value="choice">Choice</option>
                  </select>
                </div>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>{creating ? 'Adding…' : 'Add Referrer'}</Button>
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
      ) : referrers.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No referrers yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {referrers.map((r) => (
            <Link key={r.id} href={`/referrals/${r.id}`}>
              <Card className="rounded-xl shadow-sm border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="px-5 py-4 space-y-2">
                  <div className="flex items-start justify-between">
                    <p className="font-semibold text-slate-900">{r.name}</p>
                    <span className={`text-xs rounded-full px-2 py-0.5 font-semibold capitalize ${CONSENT_CLASSES[r.consent_state] ?? ''}`}>
                      {r.consent_state.replace('_', ' ')}
                    </span>
                  </div>
                  {r.referrer_code && <p className="text-xs font-mono text-slate-500">{r.referrer_code}</p>}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-slate-500">Bookings: </span>
                      <span className="font-medium text-slate-900">{r.bookings_count}</span>
                    </div>
                    <div>
                      <span className="text-slate-500">Reward: </span>
                      <span className="font-medium text-slate-900 capitalize">{r.reward_preference}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
