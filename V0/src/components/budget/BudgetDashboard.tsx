'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type Budget = {
  id: string;
  fy_year: number;
  plan_code: string | null;
  state: string;
  total_marketing_budget: number | null;
  total_booking_target_value: number | null;
  default_spend_pct: number | null;
  created_at: string;
};

const STATE_CLASSES: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 border-slate-200',
  in_review: 'bg-amber-100 text-amber-800 border-amber-200',
  approved: 'bg-blue-100 text-blue-800 border-blue-200',
  active: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  superseded: 'bg-orange-100 text-orange-800 border-orange-200',
  archived: 'bg-slate-100 text-slate-500 border-slate-200',
};

type CreateFormState = {
  fy_year: string;
  plan_code: string;
  total_booking_target_value: string;
  default_spend_pct: string;
  notes: string;
};

const DEFAULT_FORM: CreateFormState = {
  fy_year: new Date().getFullYear().toString(),
  plan_code: '',
  total_booking_target_value: '',
  default_spend_pct: '0.02',
  notes: '',
};

export function BudgetDashboard() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/budget', { headers: { 'x-org-id': ORG_ID } });
      if (!res.ok) { setError(`Failed to load budgets (HTTP ${res.status}).`); return; }
      const d = (await res.json()) as { budgets: Budget[] };
      setBudgets(d.budgets ?? []);
    } catch {
      setError('Failed to load budgets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchBudgets(); }, [fetchBudgets]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = { fy_year: parseInt(form.fy_year, 10) };
      if (form.plan_code) body.plan_code = form.plan_code;
      if (form.total_booking_target_value) body.total_booking_target_value = parseInt(form.total_booking_target_value, 10);
      if (form.default_spend_pct) body.default_spend_pct = parseFloat(form.default_spend_pct);
      if (form.notes) body.notes = form.notes;

      const res = await fetch('/api/budget', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create budget.');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchBudgets();
    } catch {
      setCreateError('Failed to create budget.');
    } finally {
      setCreating(false);
    }
  };

  if (error) {
    return <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">{error}</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${budgets.length} budget plan${budgets.length !== 1 ? 's' : ''}`}
        </p>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setCreateError(null); }}>
          {showForm ? 'Cancel' : 'Create Budget'}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">New Budget Plan</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    FY Year <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number" required min="2020" max="2040"
                    value={form.fy_year}
                    onChange={(e) => setForm((f) => ({ ...f, fy_year: e.target.value }))}
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Plan Code</label>
                  <input
                    type="text"
                    value={form.plan_code}
                    onChange={(e) => setForm((f) => ({ ...f, plan_code: e.target.value }))}
                    placeholder="e.g. FY26-Q1"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Booking Target (paise)</label>
                  <input
                    type="number" min="0"
                    value={form.total_booking_target_value}
                    onChange={(e) => setForm((f) => ({ ...f, total_booking_target_value: e.target.value }))}
                    placeholder="e.g. 50000000000"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Spend % (decimal)</label>
                  <input
                    type="number" min="0" max="1" step="0.001"
                    value={form.default_spend_pct}
                    onChange={(e) => setForm((f) => ({ ...f, default_spend_pct: e.target.value }))}
                    placeholder="e.g. 0.02"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create'}
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); setCreateError(null); }}>
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <div key={i} className="h-36 rounded-xl bg-slate-100 animate-pulse" />)}
        </div>
      ) : budgets.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No budget plans yet. Create your first budget above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {budgets.map((b) => (
            <Link key={b.id} href={`/budget/${b.id}`}>
              <Card className="rounded-xl shadow-sm border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                <CardContent className="px-5 py-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-slate-900">FY {b.fy_year}</p>
                      {b.plan_code && <p className="text-xs text-slate-500 mt-0.5">{b.plan_code}</p>}
                    </div>
                    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${STATE_CLASSES[b.state] ?? ''}`}>
                      {b.state.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <p className="text-xs text-slate-500">Marketing Budget</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">{formatInrLakh(b.total_marketing_budget)}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Spend %</p>
                      <p className="text-sm font-semibold text-slate-900 mt-0.5">
                        {b.default_spend_pct != null ? `${(b.default_spend_pct * 100).toFixed(1)}%` : '—'}
                      </p>
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
