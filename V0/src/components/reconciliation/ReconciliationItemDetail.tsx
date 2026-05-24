'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';
import GeoSuggestions from './GeoSuggestions';

type RecItem = {
  id: string;
  item_type: string;
  state: string;
  severity: string;
  monetary_impact: number | null;
  sla_deadline_at: string | null;
  context: Record<string, unknown>;
  resolution: string | null;
  resolution_actions: Record<string, unknown> | null;
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

const TYPE_GUIDANCE: Record<string, { options: { value: string; label: string }[]; desc: string }> = {
  disputed_cp_credit: {
    desc: "A channel partner's credit claim was blocked because a prior online source was found. Review the timeline and decide whether to override attribution in favour of the CP or confirm online source wins.",
    options: [
      { value: 'confirm_online_first', label: 'Confirm: Online source wins — no change to attribution' },
      { value: 'override_attribution', label: 'Override: Grant credit to CP (triggers commission accrual)' },
      { value: 'escalate_to_cmo', label: 'Escalate to CMO for decision' },
    ],
  },
  unmatched_walk_in: {
    desc: 'A walk-in arrived with no prior MIH lead record. Assign a source so attribution can proceed.',
    options: [
      { value: 'assign_source_hoarding', label: 'Attribute to: Nearby hoarding / BTL activity' },
      { value: 'assign_source_walk_in_unknown', label: 'Attribute to: Walk-In Unknown (fallback source)' },
      { value: 'backfill_manual_lead', label: 'Backfill a manual lead record then attribute' },
    ],
  },
  manual_call_no_tracking: {
    desc: 'A sales rep claims a conversion via phone but no tracked call exists in MIH. Accept or reject the claim.',
    options: [
      { value: 'accept_manual_call', label: 'Accept: Create attribution for this source' },
      { value: 'reject_no_evidence', label: 'Reject: No tracked call — lead stays unattributed' },
      { value: 'request_evidence', label: 'Request evidence from rep before deciding' },
    ],
  },
  orphan_spend_investigation: {
    desc: 'High spend detected for a source with zero bookings. Investigate whether this source is underperforming or attribution is missing.',
    options: [
      { value: 'source_underperforming', label: 'Confirm underperforming — pause or reduce budget for source' },
      { value: 'attribution_gap', label: 'Attribution gap — leads exist but are not tracked' },
      { value: 'no_action_pipeline_lag', label: 'No action: Pipeline lag — bookings expected later in cycle' },
    ],
  },
  low_conf_identity_merge: {
    desc: 'Two identity clusters were flagged for a potential merge but confidence was below auto-merge threshold.',
    options: [
      { value: 'approve_merge', label: 'Approve merge — they are the same person' },
      { value: 'reject_merge', label: 'Reject — keep as separate identities' },
      { value: 'household_link', label: 'Household link — related but distinct (e.g. spouse)' },
    ],
  },
  comment_source_override: {
    desc: 'CRM notes mention a source that differs from the current attribution. Review the extracted hint and decide.',
    options: [
      { value: 'accept_comment_override', label: 'Accept: Re-attribute to source mentioned in comment' },
      { value: 'reject_comment', label: 'Reject: Current attribution is correct' },
    ],
  },
};

function severityVariant(s: string): 'destructive' | 'warning' | 'secondary' | 'info' {
  if (s === 'critical') return 'destructive';
  if (s === 'high') return 'warning';
  if (s === 'normal') return 'info';
  return 'secondary';
}

function stateVariant(s: string): 'success' | 'info' | 'warning' | 'destructive' | 'secondary' {
  if (s === 'resolved' || s === 'closed') return 'success';
  if (s === 'in_review') return 'info';
  if (s === 'escalated') return 'warning';
  if (s === 'expired') return 'destructive';
  return 'secondary';
}

export function ReconciliationItemDetail({ id }: { id: string }) {
  const orgId = useOrgId();
  const [item, setItem] = useState<RecItem | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolution, setResolution] = useState('');
  const [selectedOption, setSelectedOption] = useState('');
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
      if (itemRes.ok) setItem((await itemRes.json() as { item: RecItem }).item);
      if (auditRes.ok) setAudit((await auditRes.json() as { audit: AuditEntry[] }).audit ?? []);
    } finally {
      setLoading(false);
    }
  }, [id, orgId]);

  useEffect(() => { void fetchAll(); }, [fetchAll]);

  const handleResolve = async () => {
    const finalResolution = selectedOption || resolution.trim();
    if (!finalResolution) return;
    setResolving(true);
    try {
      const res = await fetch(`/api/reconciliation/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({
          action: 'resolve',
          resolution: finalResolution,
          resolved_by: 'user',
          resolution_actions: selectedOption
            ? { action_type: selectedOption, context: item?.context ?? {} }
            : undefined,
        }),
      });
      if (res.ok) {
        setResolution('');
        setSelectedOption('');
        await fetchAll();
      }
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
  const guidance = TYPE_GUIDANCE[item.item_type];
  const actionsExecuted = item.resolution_actions?.actions_taken as string[] | undefined;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <Link href="/reconciliation" className="text-sm text-blue-600 hover:underline">
          ← Reconciliation Queue
        </Link>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <h1 className="text-xl font-bold text-slate-900">
            {TYPE_LABELS[item.item_type] ?? item.item_type}
          </h1>
          <Badge variant={stateVariant(item.state)} className="capitalize">
            {item.state.replace(/_/g, ' ')}
          </Badge>
          <Badge variant={severityVariant(item.severity)} className="capitalize">
            {item.severity}
          </Badge>
          {isBreached && !isResolved && <Badge variant="destructive">SLA Breached</Badge>}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Monetary Impact</p>
            <p className="text-base font-bold text-slate-900 mt-0.5">
              {item.monetary_impact != null ? formatInrLakh(item.monetary_impact) : '—'}
            </p>
          </CardContent>
        </Card>
        <Card className={`rounded-xl shadow-sm border ${isBreached && !isResolved ? 'border-red-200 bg-red-50' : 'border-slate-200'}`}>
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">SLA Deadline</p>
            <p className={`text-xs font-semibold mt-0.5 ${isBreached && !isResolved ? 'text-red-700' : 'text-slate-900'}`}>
              {item.sla_deadline_at
                ? new Date(item.sla_deadline_at).toLocaleString('en-IN', {
                    day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                  })
                : '—'}
              {isBreached && !isResolved && ' ⚠'}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Created</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5">
              {new Date(item.created_at).toLocaleDateString('en-IN', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </CardContent>
        </Card>
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardContent className="px-4 py-3">
            <p className="text-xs text-slate-500">Assigned To</p>
            <p className="text-xs font-semibold text-slate-900 mt-0.5 truncate">
              {item.assigned_to ?? 'Unassigned'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Context */}
      {Object.keys(item.context).length > 0 && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Context</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <pre className="text-xs text-slate-600 bg-slate-50 rounded p-3 overflow-auto max-h-48 leading-relaxed">
              {JSON.stringify(item.context, null, 2)}
            </pre>
          </CardContent>
        </Card>
      )}

      {/* Geo Suggestions for unmatched walk-ins */}
      {item.item_type === 'unmatched_walk_in' && (
        <div className="mt-4">
          <GeoSuggestions itemId={item.id} orgId={orgId} />
        </div>
      )}

      {/* Resolution panel */}
      {!isResolved && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">Resolution</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4 space-y-4">
            {/* State transitions */}
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

            {/* Type-specific options */}
            {guidance && (
              <div className="rounded-md bg-blue-50 border border-blue-100 px-4 py-3 space-y-3">
                <p className="text-xs text-blue-800">{guidance.desc}</p>
                <div className="space-y-2">
                  {guidance.options.map((opt) => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name={`resolution-option-${id}`}
                        value={opt.value}
                        checked={selectedOption === opt.value}
                        onChange={() => setSelectedOption(opt.value)}
                        className="mt-0.5 accent-blue-600"
                      />
                      <span className="text-xs text-blue-900">{opt.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Free-text notes */}
            <div className="space-y-2">
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Resolution Notes {!guidance && '*'}
              </label>
              <textarea
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                rows={2}
                placeholder={guidance ? 'Add context to the selected option…' : 'Describe the resolution…'}
                className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Button
              size="sm"
              onClick={() => void handleResolve()}
              disabled={resolving || (!selectedOption && !resolution.trim())}
            >
              {resolving ? 'Resolving…' : 'Resolve Item'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Resolved result */}
      {item.resolution && (
        <Card className="rounded-xl shadow-sm border-emerald-200 bg-emerald-50">
          <CardContent className="px-5 py-4">
            <p className="text-xs font-semibold text-emerald-700 uppercase tracking-wide mb-1">Resolution</p>
            <p className="text-sm text-emerald-900">{item.resolution}</p>
            {actionsExecuted && actionsExecuted.length > 0 && (
              <div className="mt-2 space-y-0.5">
                <p className="text-xs font-semibold text-emerald-700">Downstream actions taken:</p>
                {actionsExecuted.map((a, i) => (
                  <p key={i} className="text-xs text-emerald-600">• {a}</p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit trail */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Audit Trail</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4 space-y-4">
          {audit.length === 0 ? (
            <p className="text-sm text-slate-400">No audit entries yet.</p>
          ) : (
            <ol className="relative ml-3 border-l border-slate-200 space-y-4">
              {audit.map((a) => (
                <li key={a.id} className="ml-5">
                  <span className="absolute -left-1.5 flex h-3 w-3 items-center justify-center rounded-full bg-white ring-2 ring-slate-300" />
                  <div>
                    <span className="text-sm font-medium text-slate-700 capitalize">
                      {a.action.replace(/_/g, ' ')}
                    </span>
                    {a.note && <span className="text-sm text-slate-500"> — {a.note}</span>}
                    {a.actor_id && <span className="text-xs text-slate-400"> by {a.actor_id}</span>}
                    <p className="text-xs text-slate-400 mt-0.5">
                      {new Date(a.created_at).toLocaleString('en-IN', {
                        day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit',
                      })}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}

          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleAddNote(); }}
              placeholder="Add a note…"
              className="flex-1 rounded-md border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <Button size="sm" variant="outline" onClick={() => void handleAddNote()} disabled={addingNote || !note.trim()}>
              {addingNote ? '…' : 'Add'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
