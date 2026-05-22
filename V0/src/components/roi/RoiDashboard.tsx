'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type FunnelEntry = {
  source_id: string;
  source_name: string;
  leads: number;
  qualified: number;
  site_visits: number;
  bookings: number;
  spend: number;
  cpb: number;
  cpl: number;
};

export function RoiDashboard() {
  const [funnel, setFunnel] = useState<FunnelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState(0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [funnelRes, spendRes] = await Promise.all([
        fetch('/api/metrics/funnel?group_by=source', { headers: { 'x-org-id': ORG_ID } }),
        fetch('/api/spend/entries', { headers: { 'x-org-id': ORG_ID } }),
      ]);
      if (funnelRes.ok) {
        const d = (await funnelRes.json()) as { funnel: FunnelEntry[] };
        setFunnel(d.funnel ?? []);
      }
      if (spendRes.ok) {
        const d = (await spendRes.json()) as { entries: { amount_paise: number }[] };
        const total = (d.entries ?? []).reduce((acc, e) => acc + e.amount_paise, 0);
        setTotalSpend(total);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalLeads = funnel.reduce((acc, f) => acc + f.leads, 0);
  const totalBookings = funnel.reduce((acc, f) => acc + f.bookings, 0);
  const overallCPB = totalBookings > 0 ? Math.round(totalSpend / totalBookings) : 0;
  const overallCPL = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Spend', value: formatInrLakh(totalSpend) },
          { label: 'Total Leads', value: loading ? '…' : totalLeads.toLocaleString('en-IN') },
          { label: 'CPB (Cost/Booking)', value: overallCPB > 0 ? formatInrLakh(overallCPB) : '—' },
          { label: 'CPL (Cost/Lead)', value: overallCPL > 0 ? formatInrLakh(overallCPL) : '—' },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="px-4 py-3">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{loading ? <span className="text-slate-300 animate-pulse">—</span> : stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Funnel by Source</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 flex flex-col gap-2 px-5">
              {[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />)}
            </div>
          ) : funnel.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No data yet. Add spend entries and sources to see funnel data.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Source</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Leads</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Qualified</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Bookings</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Spend</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">CPB</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {funnel.map((f) => (
                    <tr key={f.source_id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 font-medium text-slate-900">{f.source_name}</td>
                      <td className="px-4 py-2.5 text-right">{f.leads.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right">{f.qualified.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right">{f.bookings.toLocaleString('en-IN')}</td>
                      <td className="px-4 py-2.5 text-right">{formatInrLakh(f.spend)}</td>
                      <td className="px-4 py-2.5 text-right">{f.cpb > 0 ? formatInrLakh(f.cpb) : '—'}</td>
                      <td className="px-4 py-2.5 text-right">{f.cpl > 0 ? formatInrLakh(f.cpl) : '—'}</td>
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
