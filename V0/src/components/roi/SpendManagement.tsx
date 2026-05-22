'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type SpendEntry = {
  id: string;
  amount_paise: number;
  period_start: string;
  period_end: string;
  entry_kind: string;
  medium: string | null;
  description: string | null;
  created_at: string;
};

type CreateFormState = {
  amount_paise: string;
  period_start: string;
  period_end: string;
  entry_kind: string;
  medium: string;
  description: string;
};

const DEFAULT_FORM: CreateFormState = {
  amount_paise: '',
  period_start: '',
  period_end: '',
  entry_kind: 'manual',
  medium: '',
  description: '',
};

export function SpendManagement() {
  const [entries, setEntries] = useState<SpendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/spend/entries', { headers: { 'x-org-id': ORG_ID } });
      if (res.ok) {
        const d = (await res.json()) as { entries: SpendEntry[] };
        setEntries(d.entries ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchEntries(); }, [fetchEntries]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        amount_paise: parseInt(form.amount_paise, 10),
        period_start: form.period_start,
        period_end: form.period_end,
        entry_kind: form.entry_kind,
      };
      if (form.medium) body.medium = form.medium;
      if (form.description) body.description = form.description;

      const res = await fetch('/api/spend/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create entry.');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchEntries();
    } catch {
      setCreateError('Failed to create entry.');
    } finally {
      setCreating(false);
    }
  };

  const totalSpend = entries.reduce((acc, e) => acc + e.amount_paise, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-500">{loading ? 'Loading…' : `${entries.length} entries`}</p>
          {!loading && <p className="text-xs text-slate-400">Total: {formatInrLakh(totalSpend)}</p>}
        </div>
        <Button size="sm" onClick={() => { setShowForm((v) => !v); setCreateError(null); }}>
          {showForm ? 'Cancel' : 'Log Spend'}
        </Button>
      </div>

      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Log Spend Entry</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Amount (paise) *</label>
                  <input type="number" required min="0" value={form.amount_paise} onChange={(e) => setForm((f) => ({ ...f, amount_paise: e.target.value }))} placeholder="e.g. 5000000" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Entry Kind *</label>
                  <select required value={form.entry_kind} onChange={(e) => setForm((f) => ({ ...f, entry_kind: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="manual">Manual</option>
                    <option value="api_pulled">API Pulled</option>
                    <option value="csv">CSV</option>
                    <option value="invoice">Invoice</option>
                    <option value="recurring_amortized">Recurring Amortized</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Period Start *</label>
                  <input type="date" required value={form.period_start} onChange={(e) => setForm((f) => ({ ...f, period_start: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Period End *</label>
                  <input type="date" required value={form.period_end} onChange={(e) => setForm((f) => ({ ...f, period_end: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Medium</label>
                  <select value={form.medium} onChange={(e) => setForm((f) => ({ ...f, medium: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="">— Select —</option>
                    {['online','btl','cp','referral','portals','branding','walk_in'].map((m) => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Description</label>
                  <input type="text" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} placeholder="e.g. Google Ads April 2026" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>{creating ? 'Saving…' : 'Save Entry'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardContent className="p-0">
          {loading ? (
            <div className="py-8 space-y-2 px-5">{[...Array(4)].map((_, i) => <div key={i} className="h-8 rounded bg-slate-100 animate-pulse" />)}</div>
          ) : entries.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No spend entries yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Description</th>
                    <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Amount</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">Medium</th>
                    <th className="px-4 py-2.5 text-center font-semibold text-slate-500">Kind</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Period</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b last:border-0 hover:bg-slate-50">
                      <td className="px-4 py-2.5 text-slate-700">{e.description ?? '—'}</td>
                      <td className="px-4 py-2.5 text-right font-medium">{formatInrLakh(e.amount_paise)}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-500 capitalize">{e.medium ?? '—'}</td>
                      <td className="px-4 py-2.5 text-center text-xs text-slate-500">{e.entry_kind}</td>
                      <td className="px-4 py-2.5 text-slate-500 text-xs">{e.period_start} → {e.period_end}</td>
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
