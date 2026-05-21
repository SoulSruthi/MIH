'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type Budget = {
  id: string;
  project_id: string;
  fy_year: number;
  total_paise: number;
  notes: string | null;
  created_at: string;
};

type VariancePeriod = {
  period_id: string;
  period_type: string;
  period_label: string;
  planned_paise: number;
  actual_paise: number;
  variance_paise: number;
  variance_pct: number | null;
  is_over_budget: boolean;
};

function VarianceBadge({ vPct, vPaise }: { vPct: number | null; vPaise: number }) {
  if (vPaise === 0) return <Badge className="bg-slate-100 text-slate-600 border-slate-200">On plan</Badge>;
  if (vPaise > 0) return <Badge className="bg-red-100 text-red-700 border-red-200">+{vPct?.toFixed(1)}% over</Badge>;
  return <Badge className="bg-emerald-100 text-emerald-700 border-emerald-200">{vPct?.toFixed(1)}% under</Badge>;
}

type CreateFormState = { project_id: string; fy_year: string; total_paise: string; notes: string };
const DEFAULT_FORM: CreateFormState = { project_id: '', fy_year: '', total_paise: '', notes: '' };

export function BudgetsDashboard() {
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [selectedBudget, setSelectedBudget] = useState<string | null>(null);
  const [variance, setVariance] = useState<VariancePeriod[]>([]);
  const [varianceLoading, setVarianceLoading] = useState(false);

  const fetchBudgets = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/budgets', { headers: { 'x-org-id': ORG_ID } });
      const json = await res.json();
      setBudgets(json.budgets ?? []);
    } catch {
      setError('Failed to load budgets');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchBudgets(); }, [fetchBudgets]);

  const fetchVariance = useCallback(async (budgetId: string) => {
    setVarianceLoading(true);
    try {
      const res = await fetch(`/api/budgets/${budgetId}/variance?period_type=quarterly`, {
        headers: { 'x-org-id': ORG_ID },
      });
      const json = await res.json();
      setVariance(json.periods ?? []);
    } finally {
      setVarianceLoading(false);
    }
  }, []);

  const handleSelectBudget = (id: string) => {
    if (selectedBudget === id) {
      setSelectedBudget(null);
      setVariance([]);
    } else {
      setSelectedBudget(id);
      fetchVariance(id);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch('/api/budgets', {
        method: 'POST',
        headers: { 'x-org-id': ORG_ID, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_id: form.project_id,
          fy_year: parseInt(form.fy_year),
          total_paise: Math.round(parseFloat(form.total_paise) * 100),
          notes: form.notes || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        setError(j.error ?? 'Failed to create budget');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchBudgets();
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-slate-500 text-sm">Loading budgets…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-slate-500">{budgets.length} budget{budgets.length !== 1 ? 's' : ''}</span>
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Cancel' : '+ New Budget'}
        </Button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      {showForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Create Budget</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-xs text-slate-600 mb-1">Project ID</label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={form.project_id}
                  onChange={(e) => setForm((f) => ({ ...f, project_id: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">FY Year (e.g. 2026 for FY2026-27)</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={form.fy_year}
                  onChange={(e) => setForm((f) => ({ ...f, fy_year: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Total Budget (₹ in rupees)</label>
                <input
                  type="number"
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={form.total_paise}
                  onChange={(e) => setForm((f) => ({ ...f, total_paise: e.target.value }))}
                  required
                />
              </div>
              <div>
                <label className="block text-xs text-slate-600 mb-1">Notes (optional)</label>
                <input
                  className="w-full border rounded px-2 py-1 text-sm"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </div>
              <Button type="submit" size="sm" disabled={saving}>
                {saving ? 'Creating…' : 'Create & Decompose'}
              </Button>
            </form>
          </CardContent>
        </Card>
      )}

      <div className="space-y-2">
        {budgets.map((b) => (
          <Card key={b.id} className="cursor-pointer hover:border-slate-300 transition-colors"
            onClick={() => handleSelectBudget(b.id)}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-slate-900 text-sm">
                    FY{b.fy_year}–{b.fy_year + 1}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">
                    Project: {b.project_id}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-semibold text-slate-900">
                    ₹{formatInrLakh(b.total_paise)}
                  </div>
                  {b.notes && <div className="text-xs text-slate-400">{b.notes}</div>}
                </div>
              </div>

              {selectedBudget === b.id && (
                <div className="mt-4 border-t pt-3">
                  {varianceLoading ? (
                    <div className="text-xs text-slate-400">Loading variance…</div>
                  ) : (
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500">
                          <th className="text-left pb-1">Period</th>
                          <th className="text-right pb-1">Planned</th>
                          <th className="text-right pb-1">Actual</th>
                          <th className="text-right pb-1">Variance</th>
                        </tr>
                      </thead>
                      <tbody>
                        {variance.map((p) => (
                          <tr key={p.period_id} className="border-t">
                            <td className="py-1 text-slate-700">{p.period_label}</td>
                            <td className="py-1 text-right text-slate-600">₹{formatInrLakh(p.planned_paise)}</td>
                            <td className="py-1 text-right text-slate-600">₹{formatInrLakh(p.actual_paise)}</td>
                            <td className="py-1 text-right">
                              <VarianceBadge vPct={p.variance_pct} vPaise={p.variance_paise} />
                            </td>
                          </tr>
                        ))}
                        {variance.length === 0 && (
                          <tr><td colSpan={4} className="text-slate-400 py-2 text-center">No periods found</td></tr>
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
        {budgets.length === 0 && (
          <div className="text-slate-400 text-sm text-center py-8">No budgets yet. Create one above.</div>
        )}
      </div>
    </div>
  );
}
