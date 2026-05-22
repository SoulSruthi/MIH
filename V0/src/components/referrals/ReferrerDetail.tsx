'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type Referrer = {
  id: string;
  name: string;
  referrer_code: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  consent_state: string;
  consent_channels: string[];
  bookings_count: number;
  default_commission_pct: number;
  reward_preference: string;
  is_active: boolean;
  last_referral_at: string | null;
};

type Commission = {
  id: string;
  booking_value: number;
  commission_pct: number;
  commission_value: number;
  state: string;
  reward_kind: string;
  created_at: string;
};

export function ReferrerDetail({ id }: { id: string }) {
  const [referrer, setReferrer] = useState<Referrer | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingConsent, setUpdatingConsent] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [refRes, commRes] = await Promise.all([
        fetch(`/api/referrals/${id}`, { headers: { 'x-org-id': ORG_ID } }),
        fetch(`/api/referrals/${id}/commissions`, { headers: { 'x-org-id': ORG_ID } }),
      ]);
      if (refRes.ok) setReferrer((await refRes.json()).referrer);
      if (commRes.ok) setCommissions((await commRes.json()).commissions ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleConsentChange = async (consentState: string) => {
    setUpdatingConsent(true);
    try {
      const res = await fetch(`/api/referrals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify({ consent_state: consentState }),
      });
      if (res.ok) await fetchAll();
    } finally {
      setUpdatingConsent(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>;
  if (!referrer) return <div className="py-12 text-center text-slate-400">Referrer not found.</div>;

  const totalCommissions = commissions.reduce((acc, c) => acc + (c.commission_value ?? 0), 0);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/referrals" className="text-sm text-blue-600 hover:underline">← Referral Program</Link>
        <h1 className="text-2xl font-bold text-slate-900 mt-1">{referrer.name}</h1>
        {referrer.referrer_code && <p className="text-sm font-mono text-slate-500">{referrer.referrer_code}</p>}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Bookings</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{referrer.bookings_count}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Total Commissions</p>
            <p className="text-lg font-bold text-slate-900 mt-0.5">{formatInrLakh(totalCommissions)}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Consent</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5 capitalize">{referrer.consent_state.replace('_', ' ')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Reward Preference</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5 capitalize">{referrer.reward_preference}</p>
          </CardContent>
        </Card>
      </div>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Consent Management</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="flex items-center gap-3">
            <p className="text-sm text-slate-600">Current: <span className="font-medium capitalize">{referrer.consent_state.replace('_', ' ')}</span></p>
            <Button size="sm" variant="outline" onClick={() => void handleConsentChange('opted_in')} disabled={updatingConsent || referrer.consent_state === 'opted_in'}>
              Opt In
            </Button>
            <Button size="sm" variant="outline" onClick={() => void handleConsentChange('opted_out')} disabled={updatingConsent || referrer.consent_state === 'opted_out'}>
              Opt Out
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Commission Accruals</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {commissions.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No commissions yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Booking Value</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Commission</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">Reward</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">State</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {commissions.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5">{formatInrLakh(c.booking_value)}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatInrLakh(c.commission_value)}</td>
                      <td className="px-4 py-2.5 text-center capitalize">{c.reward_kind}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className="inline-block rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 text-xs font-semibold capitalize">{c.state}</span>
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{new Date(c.created_at).toLocaleDateString('en-IN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
