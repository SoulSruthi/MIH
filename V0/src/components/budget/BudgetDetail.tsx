'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';

type Budget = {
  id: string;
  fy_year: number;
  plan_code: string | null;
  state: string;
  total_marketing_budget: number | null;
  total_booking_target_value: number | null;
  default_spend_pct: number | null;
  notes: string | null;
};

type Period = {
  id: string;
  period_label: string;
  planned_paise: number | null;
  actual_paise: number | null;
  is_locked: boolean;
};

type Variance = {
  period_id: string;
  period_label: string;
  planned_paise: number;
  actual_paise: number;
  variance_paise: number;
  variance_pct: number | null;
};

export function BudgetDetail({ id }: { id: string }) {
  const orgId = useOrgId();
  const [budget, setBudget] = useState<Budget | null>(null);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [variance, setVariance] = useState<Variance[]>([]);
  const [loading, setLoading] = useState(true);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [budgetRes, periodsRes, varianceRes] = await Promise.all([
        fetch(`/api/budget/${id}`, { headers: { 'x-org-id': orgId } }),
        fetch(`/api/budget/${id}/periods`, { headers: { 'x-org-id': orgId } }),
        fetch(`/api/budget/${id}/variance`, { headers: { 'x-org-id': orgId } }),
      ]);

      if (budgetRes.ok) setBudget((await budgetRes.json()).budget);
      if (periodsRes.ok) setPeriods((await periodsRes.json()).periods ?? []);
      if (varianceRes.ok) setVariance((await varianceRes.json()).variance ?? []);
    } catch {
      setError('Failed to load budget.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleActivate = async () => {
    setActivating(true);
    try {
      const res = await fetch(`/api/budget/${id}/activate`, {
        method: 'POST',
        headers: { 'x-org-id': orgId },
      });
      if (res.ok) await fetchAll();
    } finally {
      setActivating(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>;
  if (error) return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  if (!budget) return <div className="py-12 text-center text-slate-400">Budget not found.</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/budget" className="text-sm text-blue-600 hover:underline">← Budgets</Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">FY {budget.fy_year} {budget.plan_code && `— ${budget.plan_code}`}</h1>
          <p className="text-sm text-slate-500 capitalize">{budget.state.replace('_', ' ')}</p>
        </div>
        {['draft', 'approved', 'in_review'].includes(budget.state) && (
          <Button size="sm" onClick={() => void handleActivate()} disabled={activating}>
            {activating ? 'Activating…' : 'Activate'}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Marketing Budget', value: formatInrLakh(budget.total_marketing_budget) },
          { label: 'Booking Target', value: formatInrLakh(budget.total_booking_target_value) },
          { label: 'Spend %', value: budget.default_spend_pct != null ? `${(budget.default_spend_pct * 100).toFixed(1)}%` : '—' },
          { label: 'Periods', value: periods.length.toString() },
        ].map((stat) => (
          <Card key={stat.label} className="rounded-xl shadow-sm border-slate-200">
            <CardContent className="px-4 py-3">
              <p className="text-xs text-slate-500">{stat.label}</p>
              <p className="text-lg font-bold text-slate-900 mt-0.5">{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {periods.length > 0 && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Budget Periods</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Period</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Planned</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Actual</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">Locked</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((p) => (
                    <tr key={p.id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-900">{p.period_label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatInrLakh(p.planned_paise)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatInrLakh(p.actual_paise)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${p.is_locked ? 'bg-red-500' : 'bg-green-400'}`} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {variance.length > 0 && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Variance Analysis</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Period</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Planned</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Actual</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Variance</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">%</th>
                  </tr>
                </thead>
                <tbody>
                  {variance.map((v) => (
                    <tr key={v.period_id} className="border-b last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-2.5 text-slate-900">{v.period_label}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatInrLakh(v.planned_paise)}</td>
                      <td className="px-4 py-2.5 text-right text-slate-700">{formatInrLakh(v.actual_paise)}</td>
                      <td className={`px-4 py-2.5 text-right font-medium ${v.variance_paise >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {v.variance_paise >= 0 ? '+' : ''}{formatInrLakh(v.variance_paise)}
                      </td>
                      <td className={`px-4 py-2.5 text-right font-medium ${v.variance_paise >= 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                        {v.variance_pct != null ? `${v.variance_pct >= 0 ? '+' : ''}${v.variance_pct.toFixed(1)}%` : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {budget.notes && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</p>
            <p className="text-sm text-slate-700">{budget.notes}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
