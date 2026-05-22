'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type ChannelPartner = {
  id: string;
  name: string;
  code: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  is_active: boolean;
};

type Commission = {
  id: string;
  conversion_event_id: string;
  deal_value_paise: number;
  commission_paise: number;
  status: string;
  created_at: string;
};

type Performance = {
  month_year: string;
  leads_pushed_count: number;
  bookings_count: number;
  bookings_value_paise: number;
  commission_paise: number;
};

export function ChannelPartnerDetail({ id }: { id: string }) {
  const [cp, setCp] = useState<ChannelPartner | null>(null);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [performance, setPerformance] = useState<Performance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cpRes, commRes, perfRes] = await Promise.all([
        fetch(`/api/channel-partners/${id}`, { headers: { 'x-org-id': ORG_ID } }),
        fetch(`/api/channel-partners/${id}/commissions`, { headers: { 'x-org-id': ORG_ID } }),
        fetch(`/api/channel-partners/${id}/performance`, { headers: { 'x-org-id': ORG_ID } }),
      ]);
      if (!cpRes.ok) { setError('Channel partner not found'); return; }
      const [cpJson, commJson, perfJson] = await Promise.all([
        cpRes.json(), commRes.json(), perfRes.json(),
      ]);
      setCp(cpJson.channel_partner);
      setCommissions(commJson.commissions ?? []);
      setPerformance(perfJson.performance ?? []);
    } catch {
      setError('Failed to load channel partner');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  if (loading) return <div className="text-slate-500 text-sm">Loading…</div>;
  if (error || !cp) return (
    <div className="space-y-2">
      <div className="text-red-600 text-sm">{error ?? 'Not found'}</div>
      <Link href="/channel-partners"><Button variant="outline" size="sm">← Back</Button></Link>
    </div>
  );

  const totalCommission = commissions.reduce((s, c) => s + c.commission_paise, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/channel-partners"><Button variant="outline" size="sm">← Back</Button></Link>
        <h1 className="text-2xl font-bold text-slate-900">{cp.name}</h1>
        {cp.code && <Badge className="bg-slate-100 text-slate-600 border-slate-200">{cp.code}</Badge>}
        <Badge className={cp.is_active ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-slate-100 text-slate-500'}>
          {cp.is_active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Total Commissions</div>
            <div className="text-xl font-bold text-slate-900">₹{formatInrLakh(totalCommission)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Total Bookings</div>
            <div className="text-xl font-bold text-slate-900">{commissions.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="text-xs text-slate-500">Contact</div>
            <div className="text-sm font-medium text-slate-700">{cp.contact_name ?? '—'}</div>
            <div className="text-xs text-slate-400">{cp.contact_email ?? ''}</div>
          </CardContent>
        </Card>
      </div>

      {performance.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Monthly Performance</CardTitle></CardHeader>
          <CardContent>
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-left pb-2">Month</th>
                  <th className="text-right pb-2">Leads Pushed</th>
                  <th className="text-right pb-2">Bookings</th>
                  <th className="text-right pb-2">Value</th>
                  <th className="text-right pb-2">Commission</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((p) => (
                  <tr key={p.month_year} className="border-t">
                    <td className="py-1.5 text-slate-700">{p.month_year}</td>
                    <td className="py-1.5 text-right text-slate-600">{p.leads_pushed_count}</td>
                    <td className="py-1.5 text-right text-slate-600">{p.bookings_count}</td>
                    <td className="py-1.5 text-right text-slate-600">₹{formatInrLakh(p.bookings_value_paise)}</td>
                    <td className="py-1.5 text-right font-medium text-slate-900">₹{formatInrLakh(p.commission_paise)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">Recent Commissions</CardTitle></CardHeader>
        <CardContent>
          {commissions.length === 0 ? (
            <div className="text-slate-400 text-sm">No commissions yet.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-500 border-b">
                  <th className="text-left pb-2">Date</th>
                  <th className="text-right pb-2">Deal Value</th>
                  <th className="text-right pb-2">Commission</th>
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
                        c.status === 'disputed' ? 'bg-red-100 text-red-700 border-red-200' :
                        'bg-amber-100 text-amber-700 border-amber-200'
                      }>{c.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
