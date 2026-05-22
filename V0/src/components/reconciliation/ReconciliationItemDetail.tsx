'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';

type RecItem = {
  id: string;
  item_type: string;
  state: string;
  severity: string;
  monetary_impact: number | null;
  sla_deadline_at: string | null;
  context: Record<string, unknown>;
  resolution: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
};

type AuditEntry = {
  id: string;
  action: string;
  actor_id: string | null;
  old_value: Record<string, unknown> | null;
  new_value: Record<string, unknown> | null;
  note: string | null;
  created_at: string;
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

export function ReconciliationItemDetail({ id }: { id: string }) {
  const orgId = useOrgId();
  const [item, setItem] = useState<RecItem | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  const [resolving, setResolving] = useState(false);
  const [note, setNote] = useState('');
  const [addingNote, setAddingNote] = useState(false);
  const [updatingState, setUpdatingState] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [itemRes, auditRes] = await Promise.all([
        fetch(`/api/reconciliation/${id}`, { headers: { 'x-org-id': orgId } }),
        fetch(`/api/reconciliation/${id}/audit`, { headers: { 'x-org-id': orgId } }),
      ]);
      if (itemRes.ok) setItem((await itemRes.json()).item);
      if (auditRes.ok) setAudit((await auditRes.json()).audit ?? []);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleResolve = async () => {
    if (!resolution.trim()) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/reconciliation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ action: 'resolve', resolution, resolved_by: 'user' }),
      });
      if (res.ok) { setResolution(''); await fetchAll(); }
    } finally {
      setResolving(false);
    }
  };

  const handleAddNote = async () => {
    if (!note.trim()) return;
    setAddingNote(true);
    try {
      const res = await fetch(`/api/reconciliation/${id}/audit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ note, actor_id: 'user' }),
      });
      if (res.ok) { setNote(''); await fetchAll(); }
    } finally {
      setAddingNote(false);
    }
  };

  const handleStateChange = async (newState: string) => {
    setUpdatingState(true);
    try {
      const res = await fetch(`/api/reconciliation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ state: newState }),
      });
      if (res.ok) await fetchAll();
    } finally {
      setUpdatingState(false);
    }
  };

  if (loading) return <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>;
  if (!item) return <div className="py-12 text-center text-slate-400">Item not found.</div>;

  const isResolved = ['resolved', 'closed'].includes(item.state);
  const isBreached = item.sla_deadline_at && new Date(item.sla_deadline_at) < new Date();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/reconciliation" className="text-sm text-blue-600 hover:underline">← Reconciliation Queue</Link>
        <h1 className="text-xl font-bold text-slate-900 mt-1">{TYPE_LABELS[item.item_type] ?? item.item_type}</h1>
        <p className="text-sm text-slate-500 capitalize">{item.state.replace('_', ' ')} · {item.severity} severity</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Monetary Impact</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">{item.monetary_impact != null ? formatInrLakh(item.monetary_impact) : '—'}</p>
          </CardContent>
        </Card>
        <Card className={`rounded-xl shadow-sm border ${isBreached ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">SLA Deadline</p>
            <p className={`text-xs font-semibold mt-0.5 ${isBreached ? 'text-red-700' : 'text-slate-900'}`}>
              {item.sla_deadline_at ? new Date(item.sla_deadline_at).toLocaleString('en-IN') : '—'}
              {isBreached && ' ⚠'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Created</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">{new Date(item.created_at).toLocaleDateString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Assigned To</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">{item.assigned_to ?? 'Unassigned'}</p>
          </CardContent>
        </Card>
      </div>

      {!isResolved && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Actions</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-4">
            <div className="flex gap-2 flex-wrap">
              {item.state === 'open' && (
                <Button size="sm" variant="outline" onClick={() => void handleStateChange('in_review')} disabled={updatingState}>
                  Move to Review
                </Button>
              )}
              {['open', 'in_review'].includes(item.state) && (
                <Button size="sm" variant="outline" onClick={() => void handleStateChange('escalated')} disabled={updatingState}>
                  Escalate
                </Button>
              )}
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Resolution *</label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={2}
                placeholder="Describe the resolution…"
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <Button size="sm" onClick={() => void handleResolve()} disabled={resolving || !resolution.trim()}>
                {resolving ? 'Resolving…' : 'Resolve Item'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {item.resolution && (
        <Card className="rounded-xl shadow-sm border-emerald-200 bg-emerald-50">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Resolution</p>
            <p className="text-sm text-emerald-900">{item.resolution}</p>
          </CardContent>
        </Card>
      )}

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Context</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 overflow-auto max-h-40">
            {JSON.stringify(item.context, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-4">
          {audit.length === 0 ? (
            <p className="text-sm text-slate-400">No audit entries yet.</p>
          ) : (
            <div className="space-y-3">
              {audit.map((a) => (
                <div key={a.id} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 w-2 h-2 mt-1.5 rounded-full bg-slate-300" />
                  <div>
                    <span className="font-medium text-slate-700 capitalize">{a.action.replace('_', ' ')}</span>
                    {a.note && <span className="text-slate-500"> — {a.note}</span>}
                    <p className="text-xs text-slate-400">{new Date(a.created_at).toLocaleString('en-IN')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="flex gap-2 pt-2">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Add a note…"
              className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button size="sm" onClick={() => void handleAddNote()} disabled={addingNote || !note.trim()}>
              {addingNote ? '…' : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
