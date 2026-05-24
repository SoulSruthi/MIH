'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';

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

type VarianceAlert = {
  id: string;
  alert_type: string;
  severity: string;
  period_start: string;
  period_end: string;
  context: Record<string, unknown>;
  resolved_at: string | null;
};

function severityBadge(s: string) {
  if (s === 'critical') return <Badge variant="destructive">{s}</Badge>;
  if (s === 'warning') return <Badge variant="warning">{s}</Badge>;
  return <Badge variant="secondary">{s}</Badge>;
}

function alertLabel(t: string) {
  const labels: Record<string, string> = {
    spend_overrun: 'Spend Overrun',
    booking_shortfall: 'Booking Shortfall',
    cpb_spike: 'CPB Spike',
    source_underperforming: 'Source Underperforming',
  };
  return labels[t] ?? t.replace(/_/g, ' ');
}

export function RoiDashboard() {
  const orgId = useOrgId();
  const [funnel, setFunnel] = useState<FunnelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalSpend, setTotalSpend] = useState(0);
  const [alerts, setAlerts] = useState<VarianceAlert[]>([]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [funnelRes, spendRes, alertsRes] = await Promise.all([
        fetch('/api/metrics/funnel?group_by=source', { headers: { 'x-org-id': orgId } }),
        fetch('/api/spend/entries', { headers: { 'x-org-id': orgId } }),
        fetch('/api/variance/alerts?resolved=false&limit=5', { headers: { 'x-org-id': orgId } }),
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
      if (alertsRes.ok) {
        const d = (await alertsRes.json()) as { alerts: VarianceAlert[] };
        setAlerts(d.alerts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalLeads = funnel.reduce((acc, f) => acc + f.leads, 0);
  const totalBookings = funnel.reduce((acc, f) => acc + f.bookings, 0);
  const overallCPB = totalBookings > 0 ? Math.round(totalSpend / totalBookings) : 0;
  const overallCPL = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

  return (
    <div className="space-y-6">
      {/* KPI bar */}
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
              <p className="text-lg font-bold text-slate-900 mt-0.5">
                {loading ? <span className="text-slate-300 animate-pulse">—</span> : stat.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Active variance alerts */}
      {!loading && alerts.length > 0 && (
        <Card className="rounded-xl shadow-sm border-amber-200 bg-amber-50">
          <CardHeader className="py-3 px-5 border-b border-amber-200">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-amber-800">Active Alerts</CardTitle>
              <Link href="/roi/alerts" className="text-xs text-amber-700 hover:underline">View all →</Link>
            </div>
          </CardHeader>
          <CardContent className="px-5 py-3 space-y-2">
            {alerts.map((a) => (
              <div key={a.id} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-amber-900 font-medium">{alertLabel(a.alert_type)}</span>
                {severityBadge(a.severity)}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Funnel by source */}
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
            <p className="px-5 py-8 text-center text-slate-400 text-sm">
              No data yet. Add spend entries and sources to see funnel data.
            </p>
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

      {/* Attribution model comparison link */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardContent className="px-5 py-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-800">Attribution Model Comparison</p>
            <p className="text-xs text-slate-500 mt-0.5">
              First-touch vs last-touch vs time-decay — side-by-side for every conversion event.
            </p>
          </div>
          <Link
            href="/roi/comparison"
            className="text-sm font-medium text-blue-600 hover:text-blue-800 whitespace-nowrap"
          >
            View comparison →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
