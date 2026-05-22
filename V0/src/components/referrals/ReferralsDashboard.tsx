'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type Referrer = {
  id: string;
  name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
  last_referral_at: string | null;
  created_at: string;
};

type Commission = {
  id: string;
  referral_event_id: string;
  deal_value_paise: number;
  commission_paise: number;
  status: string;
  created_at: string;
};

function DormancyBadge({ lastReferralAt }: { lastReferralAt: string | null }) {
  if (!lastReferralAt) {
    return <Badge className="bg-amber-100 text-amber-700 border-amber-200 text-xs">Never referred</Badge>;
  }
  const daysSince = Math.floor((Date.now() - new Date(lastReferralAt).getTime()) / 86400000);
  if (daysSince >= 90) {
    return <Badge className="bg-red-100 text-red-700 border-red-200 text-xs">Dormant ({daysSince}d)</Badge>;
  }
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200 text-xs">Active</Badge>;
}

type CreateFormState = { name: string; contact_email: string; contact_phone: string };
const DEFAULT_FORM: CreateFormState = { name: '', contact_email: '', contact_phone: '' };

export function ReferralsDashboard() {
  const [referrers, setReferrers] = useState<Referrer[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'referrers' | 'commissions'>('referrers');

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [rRes, cRes] = await Promise.all([
        fetch('/api/referrals', { headers: { 'x-org-id': ORG_ID } }),
        fetch('/api/referrals/commissions', { headers: { 'x-org-id': ORG_ID } }),
      ]);
      const [rJson, cJson] = await Promise.all([rRes.json(), cRes.json()]);
      setReferrers(rJson.referrers ?? []);
      setCommissions(cJson.commissions ?? []);
    } catch {
      setError('Failed to load referrals data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/referrals', {
        method: 'POST',
        headers: { 'x-org-id': ORG_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name || undefined,
          contact_email: form.contact_email || undefined,
          contact_phone: form.contact_phone || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Failed to add referrer');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchAll();
    } finally {
      setSaving(false);
    }
  };

  const totalCommission = commissions.reduce((s, c) => s + c.commission_paise, 0);
  const dormantCount = referrers.filter((r) => {
    if (!r.last_referral_at) return true;
    return Math.floor((Date.now() - new Date(r.last_referral_at).getTime()) / 86400000) >= 90;
  }).length;

  if (loading) return <div className="text-slate-500 text-sm">Loading referrals…</div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Total Referrers</div>
            <div className="text-xl font-bold text-slate-900">{referrers.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Dormant (90+ days)</div>
            <div className="text-xl font-bold text-amber-600">{dormantCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Total Commissions Earned</div>
            <div className="text-xl font-bold text-slate-900">₹{formatInrLakh(totalCommission)}</div>
          </CardContent>
        </Card>
      </div>

      <div className="flex gap-2 border-b">
        {(['referrers', 'commissions'] as const).map((t) => (
          <button
            key={t}
            className={`pb-2 px-1 text-sm capitalize ${tab === t ? 'border-b-2 border-slate-900 font-medium' : 'text-slate-500'}`}
            onClick={() => setTab(t)}
          >
            {t}
          </button>
        ))}
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {tab === 'referrers' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button size="sm" onClick={() => setShowForm(!showForm)}>
              {showForm ? 'Cancel' : '+ Add Referrer'}
            </Button>
          </div>

          {showForm && (
            <Card>
              <CardHeader><CardTitle className="text-base">Add Referrer</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={handleCreate} className="space-y-3">
                  {(['name', 'contact_email', 'contact_phone'] as const).map((field) => (
                    <div key={field}>
                      <label className="block text-xs text-slate-600 mb-1">{field.replace(/_/g, ' ')}</label>
                      <input
                        className="w-full border rounded px-2 py-1 text-sm"
                        value={form[field]}
                        onChange={(e) => setForm((f) => ({ ...f, [field]: e.target.value }))}
                      />
                    </div>
                  ))}
                  <Button type="submit" size="sm" disabled={saving}>{saving ? 'Adding…' : 'Add Referrer'}</Button>
                </form>
              </CardContent>
            </Card>
          )}

          <div className="space-y-2">
            {referrers.map((r) => (
              <Card key={r.id}>
                <CardContent className="pt-4 pb-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-slate-900 text-sm">{r.name ?? 'Unknown'}</span>
                        <DormancyBadge lastReferralAt={r.last_referral_at} />
                      </div>
                      {r.contact_email && <div className="text-xs text-slate-400">{r.contact_email}</div>}
                      {r.contact_phone && <div className="text-xs text-slate-400">{r.contact_phone}</div>}
                    </div>
                    <div className="text-xs text-slate-400">
                      {r.last_referral_at
                        ? `Last referral: ${new Date(r.last_referral_at).toLocaleDateString()}`
                        : 'No referrals yet'}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
            {referrers.length === 0 && (
              <div className="text-slate-400 text-sm text-center py-8">No referrers yet.</div>
            )}
          </div>
        </div>
      )}

      {tab === 'commissions' && (
        <div className="space-y-2">
          {commissions.length === 0 ? (
            <div className="text-slate-400 text-sm text-center py-8">No referral commissions yet.</div>
          ) : (
            <Card>
              <CardContent className="pt-4">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b">
                      <th className="text-left pb-2">Date</th>
                      <th className="text-right pb-2">Deal Value</th>
                      <th className="text-right pb-2">Commission (1.5%)</th>
                      <th className="text-right pb-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commissions.map((c) => (
                      <tr key={c.id} className="border-t">
                        <td className="py-1.5 text-slate-500">{new Date(c.created_at).toLocaleDateString()}</td>
                        <td className="py-1.5 text-right text-slate-600">₹{formatInrLakh(c.deal_value_paise)}</td>
                        <td className="py-1.5 text-right font-medium text-slate-900">₹{formatInrLakh(c.commission_paise)}</td>
                        <td className="py-1.5 text-right">
                          <Badge className={
                            c.status === 'paid' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' :
                            c.status === 'approved' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-amber-100 text-amber-700 border-amber-200'
                          }>{c.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
