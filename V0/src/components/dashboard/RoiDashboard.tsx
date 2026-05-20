'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

// --- Types ---

type RollupRow = {
  id: string;
  source_id: string;
  rollup_date: string;
  model_version: string;
  unique_lead_count: number;
  contacted_count: number;
  qualified_count: number;
  site_visit_count: number;
  deal_count: number;
  won_count: number;
  won_value_paise: number;
  spend_paise: number;
  cpl_paise: number | null;
  cpa_paise: number | null;
  roas_times_100: number | null;
  sources: { id: string; name: string; source_type: string } | null;
};

type SourceSummary = {
  sourceId: string;
  sourceName: string;
  sourceType: string;
  leads: number;
  contacted: number;
  qualified: number;
  deals: number;
  won: number;
  wonValuePaise: number;
  spendPaise: number;
  hasSpend: boolean;
};

// --- Helpers ---

function formatInr(paise: number): string {
  return '₹' + Math.round(paise / 100).toLocaleString('en-IN');
}

function formatCpl(paise: number | null, leads: number): string {
  if (paise === null || leads === 0) return '—';
  return formatInr(paise / leads);
}

function formatRoas(wonValue: number, spend: number): string {
  if (spend === 0) return '—';
  const roas = wonValue / spend;
  return roas.toFixed(2) + 'x';
}

function pct(num: number, den: number): number {
  if (den === 0) return 0;
  return Math.min(100, Math.round((num / den) * 100));
}

function spendStatus(summary: SourceSummary): 'complete' | 'partial' | 'missing' {
  if (summary.spendPaise > 0 && summary.hasSpend) return 'complete';
  if (summary.spendPaise > 0) return 'partial';
  return 'missing';
}

function SpendBadge({ summary }: { summary: SourceSummary }) {
  const status = spendStatus(summary);
  if (status === 'complete') return <Badge variant="success">Complete</Badge>;
  if (status === 'partial') return <Badge variant="warning">Partial</Badge>;
  return <Badge variant="destructive">Missing</Badge>;
}

// --- Aggregation ---

function aggregateRows(rows: RollupRow[]): SourceSummary[] {
  const map = new Map<string, SourceSummary>();

  for (const row of rows) {
    const existing = map.get(row.source_id);
    if (existing) {
      existing.leads += row.unique_lead_count;
      existing.contacted += row.contacted_count;
      existing.qualified += row.qualified_count;
      existing.deals += row.deal_count;
      existing.won += row.won_count;
      existing.wonValuePaise += row.won_value_paise;
      existing.spendPaise += row.spend_paise;
      if (row.spend_paise > 0) existing.hasSpend = true;
    } else {
      map.set(row.source_id, {
        sourceId: row.source_id,
        sourceName: row.sources?.name ?? row.source_id,
        sourceType: row.sources?.source_type ?? '',
        leads: row.unique_lead_count,
        contacted: row.contacted_count,
        qualified: row.qualified_count,
        deals: row.deal_count,
        won: row.won_count,
        wonValuePaise: row.won_value_paise,
        spendPaise: row.spend_paise,
        hasSpend: row.spend_paise > 0,
      });
    }
  }

  return Array.from(map.values()).sort((a, b) => b.leads - a.leads);
}

function computeTotals(summaries: SourceSummary[]) {
  return summaries.reduce(
    (acc, s) => ({
      leads: acc.leads + s.leads,
      deals: acc.deals + s.deals,
      spendPaise: acc.spendPaise + s.spendPaise,
    }),
    { leads: 0, deals: 0, spendPaise: 0 },
  );
}

// --- Funnel Visualization ---

function FunnelBar({ summaries }: { summaries: SourceSummary[] }) {
  const totals = summaries.reduce(
    (acc, s) => ({
      leads: acc.leads + s.leads,
      contacted: acc.contacted + s.contacted,
      qualified: acc.qualified + s.qualified,
      deals: acc.deals + s.deals,
      won: acc.won + s.won,
    }),
    { leads: 0, contacted: 0, qualified: 0, deals: 0, won: 0 },
  );

  const stages = [
    { label: 'Leads', value: totals.leads, color: 'bg-blue-500', textColor: 'text-blue-700' },
    {
      label: 'Contacted',
      value: totals.contacted,
      color: 'bg-indigo-500',
      textColor: 'text-indigo-700',
    },
    {
      label: 'Qualified',
      value: totals.qualified,
      color: 'bg-violet-500',
      textColor: 'text-violet-700',
    },
    {
      label: 'Deals',
      value: totals.deals,
      color: 'bg-purple-500',
      textColor: 'text-purple-700',
    },
    { label: 'Won', value: totals.won, color: 'bg-emerald-500', textColor: 'text-emerald-700' },
  ];

  const maxValue = Math.max(totals.leads, 1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Funnel Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {stages.map((stage) => {
            const widthPct = pct(stage.value, maxValue);
            return (
              <div key={stage.label} className="flex items-center gap-3">
                <span className="w-20 shrink-0 text-right text-xs font-medium text-slate-500">
                  {stage.label}
                </span>
                <div className="flex-1 rounded bg-slate-100" style={{ height: 20 }}>
                  <div
                    className={`${stage.color} h-full rounded transition-all duration-500`}
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
                <span className={`w-12 shrink-0 text-right text-xs font-semibold ${stage.textColor}`}>
                  {stage.value.toLocaleString('en-IN')}
                </span>
                {stage.label !== 'Leads' && totals.leads > 0 && (
                  <span className="w-10 shrink-0 text-right text-xs text-slate-400">
                    {pct(stage.value, totals.leads)}%
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// --- KPI Cards ---

function KpiCards({ summaries }: { summaries: SourceSummary[] }) {
  const totals = computeTotals(summaries);
  const avgCpl = totals.leads > 0 && totals.spendPaise > 0
    ? totals.spendPaise / totals.leads
    : null;

  const cards = [
    {
      label: 'Total Spend',
      value: formatInr(totals.spendPaise),
    },
    {
      label: 'Unique Leads',
      value: totals.leads.toLocaleString('en-IN'),
    },
    {
      label: 'Avg CPL',
      value: avgCpl !== null ? formatInr(avgCpl) : '—',
    },
    {
      label: 'Total Deals',
      value: totals.deals.toLocaleString('en-IN'),
    },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((card) => (
        <Card key={card.label}>
          <CardContent className="pt-6">
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wide">
              {card.label}
            </p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{card.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// --- Source Table ---

function SourceTable({ summaries }: { summaries: SourceSummary[] }) {
  if (summaries.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-slate-500">
        No attribution data for this period.
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Source</TableHead>
          <TableHead className="text-right">Leads</TableHead>
          <TableHead className="text-right">Contacted</TableHead>
          <TableHead className="text-right">Qualified</TableHead>
          <TableHead className="text-right">Deals</TableHead>
          <TableHead className="text-right">Won</TableHead>
          <TableHead className="text-right">Spend (₹)</TableHead>
          <TableHead className="text-right">CPL (₹)</TableHead>
          <TableHead className="text-right">ROAS</TableHead>
          <TableHead>Spend Data</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {summaries.map((s) => (
          <TableRow key={s.sourceId}>
            <TableCell>
              <div>
                <span className="font-medium text-slate-900">{s.sourceName}</span>
                {s.sourceType && (
                  <div className="text-xs text-slate-500 capitalize">
                    {s.sourceType.replace(/_/g, ' ')}
                  </div>
                )}
              </div>
            </TableCell>
            <TableCell className="text-right font-mono text-sm">{s.leads.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-mono text-sm">{s.contacted.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-mono text-sm">{s.qualified.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-mono text-sm">{s.deals.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-mono text-sm">{s.won.toLocaleString('en-IN')}</TableCell>
            <TableCell className="text-right font-mono text-sm">
              {s.spendPaise > 0 ? formatInr(s.spendPaise) : '—'}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatCpl(s.spendPaise > 0 ? s.spendPaise : null, s.leads)}
            </TableCell>
            <TableCell className="text-right font-mono text-sm">
              {formatRoas(s.wonValuePaise, s.spendPaise)}
            </TableCell>
            <TableCell>
              <SpendBadge summary={s} />
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- Main Component ---

const PERIODS = [
  { label: 'Last 7 days', value: 7 },
  { label: 'Last 30 days', value: 30 },
  { label: 'Last 90 days', value: 90 },
];

type Props = {
  defaultPeriod?: number;
};

export function RoiDashboard({ defaultPeriod = 30 }: Props) {
  const [period, setPeriod] = useState(defaultPeriod);
  const [rows, setRows] = useState<RollupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchRollups = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attribution/rollups?days=${period}`, {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { rollups?: RollupRow[]; rows?: RollupRow[] };
      // Support both response shapes
      setRows(json.rollups ?? json.rows ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load ROI data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchRollups();
  }, [fetchRollups]);

  const summaries = aggregateRows(rows);

  return (
    <div className="space-y-6">
      {/* Period selector */}
      <Tabs
        value={String(period)}
        onValueChange={(v) => setPeriod(Number(v))}
      >
        <TabsList>
          {PERIODS.map((p) => (
            <TabsTrigger key={p.value} value={String(p.value)}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="py-16 text-center text-sm text-slate-500">Loading ROI data…</div>
      ) : (
        <>
          {/* KPI Cards */}
          <KpiCards summaries={summaries} />

          {/* Funnel */}
          <FunnelBar summaries={summaries} />

          {/* Per-source table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance by Source</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <SourceTable summaries={summaries} />
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
