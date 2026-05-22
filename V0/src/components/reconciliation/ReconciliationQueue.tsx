'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type ReconciliationItem = {
  id: string;
  item_type: string;
  state: string;
  severity: string;
  monetary_impact: number | null;
  sla_deadline_at: string | null;
  created_at: string;
};

const SEVERITY_CLASSES: Record<string, string> = {
  low: 'bg-slate-50 text-slate-600',
  normal: 'bg-blue-50 text-blue-700',
  high: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

const STATE_CLASSES: Record<string, string> = {
  open: 'bg-blue-50 text-blue-700',
  in_review: 'bg-amber-50 text-amber-700',
  resolved: 'bg-emerald-50 text-emerald-700',
  escalated: 'bg-red-50 text-red-700',
  closed: 'bg-slate-100 text-slate-500',
  expired: 'bg-slate-100 text-slate-400',
};

const TYPE_LABELS: Record<string, string> = {
  disputed_cp_credit: 'Disputed CP Credit',
  disputed_referral_credit: 'Disputed Referral Credit',
  manual_call_no_tracking: 'Manual Call No Tracking',
  unmatched_walk_in: 'Unmatched Walk-In',
  comment_source_override: 'Comment Source Override',
  telecaller_claim_audit: 'Telecaller Claim Audit',
  sales_rep_unattended_lead: 'Unattended Lead',
  low_conf_identity_merge: 'Low Confidence Merge',
  source_disabled_violation: 'Source Disabled Violation',
  orphan_spend_investigation: 'Orphan Spend',
};

type CreateFormState = {
  item_type: string;
  severity: string;
  monetary_impact: string;
  origin_event_id: string;
};

const DEFAULT_FORM: CreateFormState = {
  item_type: 'disputed_cp_credit',
  severity: 'normal',
  monetary_impact: '',
  origin_event_id: '',
};

export function ReconciliationQueue() {
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('open');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkResolving, setBulkResolving] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reconciliation?state=${stateFilter}&limit=50`, {
        headers: { 'x-org-id': ORG_ID },
      });
      if (res.ok) {
        const d = (await res.json()) as { items: ReconciliationItem[]; total: number };
        setItems(d.items ?? []);
        setTotal(d.total ?? 0);
      }
    } finally {
      setLoading(false);
    }
  }, [stateFilter]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        item_type: form.item_type,
        severity: form.severity,
      };
      if (form.monetary_impact) body.monetary_impact = parseInt(form.monetary_impact, 10);
      if (form.origin_event_id) body.origin_event_id = form.origin_event_id;

      const res = await fetch('/api/reconciliation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create item.');
        return;
      }
      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchItems();
    } catch {
      setCreateError('Failed to create item.');
    } finally {
      setCreating(false);
    }
  };

  const handleBulkResolve = async () => {
    setBulkResolving(true);
    try {
      await fetch('/api/reconciliation/bulk-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': ORG_ID },
        body: JSON.stringify({ ids: Array.from(selected), resolution: 'Bulk resolved' }),
      });
      setSelected(new Set());
      await fetchItems();
    } finally {
      setBulkResolving(false);
    }
  };

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex gap-2 flex-wrap">
          {['open', 'in_review', 'resolved', 'escalated', 'closed'].map((s) => (
            <button
              key={s}
              onClick={() => { setStateFilter(s); setSelected(new Set()); }}
              className={`rounded-full px-3 py-1 text-xs font-semibold capitalize transition-colors ${stateFilter === s ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {s.replace('_', ' ')}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          {selected.size > 0 && (
            <Button size="sm" onClick={() => void handleBulkResolve()} disabled={bulkResolving}>
              {bulkResolving ? 'Resolving…' : `Resolve ${selected.size} selected`}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => { setShowForm((v) => !v); setCreateError(null); }}>
            {showForm ? 'Cancel' : 'Create Item'}
          </Button>
        </div>
      </div>

      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">New Reconciliation Item</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Type *</label>
                  <select required value={form.item_type} onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Severity</label>
                  <select value={form.severity} onChange={(e) => setForm((f) => ({ ...f, severity: e.target.value }))} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    <option value="low">Low</option>
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Monetary Impact (paise)</label>
                  <input type="number" min="0" value={form.monetary_impact} onChange={(e) => setForm((f) => ({ ...f, monetary_impact: e.target.value }))} placeholder="e.g. 50000000" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">Origin Event ID</label>
                  <input type="text" value={form.origin_event_id} onChange={(e) => setForm((f) => ({ ...f, origin_event_id: e.target.value }))} placeholder="e.g. lead_xyz123" className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              {createError && <p className="text-sm text-red-600">{createError}</p>}
              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>{creating ? 'Creating…' : 'Create'}</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => { setShowForm(false); setForm(DEFAULT_FORM); }}>Cancel</Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-slate-400">{total} total in this state</p>

      {loading ? (
        <div className="space-y-2">{[...Array(4)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No {stateFilter.replace('_', ' ')} items.
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const isBreached = item.sla_deadline_at && new Date(item.sla_deadline_at) < new Date();
            return (
              <div key={item.id} className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-3 h-4 w-4 rounded border-slate-300"
                  checked={selected.has(item.id)}
                  onChange={() => toggleSelect(item.id)}
                />
                <Link href={`/reconciliation/${item.id}`} className="flex-1">
                  <Card className="rounded-xl shadow-sm border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer">
                    <CardContent className="px-5 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${SEVERITY_CLASSES[item.severity] ?? ''}`}>
                              {item.severity}
                            </span>
                            <span className="text-sm font-semibold text-slate-900">
                              {TYPE_LABELS[item.item_type] ?? item.item_type}
                            </span>
                          </div>
                          {item.monetary_impact != null && (
                            <p className="text-xs text-slate-500">Impact: {formatInrLakh(item.monetary_impact)}</p>
                          )}
                          {item.sla_deadline_at && (
                            <p className={`text-xs ${isBreached ? 'text-red-600 font-medium' : 'text-slate-400'}`}>
                              SLA: {new Date(item.sla_deadline_at).toLocaleString('en-IN')} {isBreached ? '⚠ BREACHED' : ''}
                            </p>
                          )}
                        </div>
                        <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${STATE_CLASSES[item.state] ?? ''}`}>
                          {item.state.replace('_', ' ')}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
