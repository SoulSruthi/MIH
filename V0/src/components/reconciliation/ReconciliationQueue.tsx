'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { useOrgId } from '@/lib/use-org-id';
import { formatInrLakh } from '@/lib/format-inr';

type RecItem = {
  id: string;
  item_type: string;
  state: string;
  severity: string;
  monetary_impact: number | null;
  sla_deadline_at: string | null;
  context: Record<string, unknown>;
  created_at: string;
  assigned_to: string | null;
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

function severityVariant(s: string): 'destructive' | 'warning' | 'secondary' | 'info' {
  if (s === 'critical') return 'destructive';
  if (s === 'high') return 'warning';
  if (s === 'normal') return 'info';
  return 'secondary';
}

export function ReconciliationQueue() {
  const orgId = useOrgId();
  const [items, setItems] = useState<RecItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [stateFilter, setStateFilter] = useState('');
  const [severityFilter, setSeverityFilter] = useState('');
  const [page, setPage] = useState(1);
  const perPage = 20;

  const fetchItems = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), per_page: String(perPage) });
    if (stateFilter) params.set('state', stateFilter);
    if (severityFilter) params.set('severity', severityFilter);

    const res = await fetch(`/api/reconciliation?${params}`, { headers: { 'x-org-id': orgId } });
    if (res.ok) {
      const data = await res.json() as { items: RecItem[]; total: number };
      setItems(data.items);
      setTotal(data.total);
    }
    setLoading(false);
  }, [orgId, page, stateFilter, severityFilter]);

  useEffect(() => { void fetchItems(); }, [fetchItems]);

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-xl font-bold text-slate-900">Reconciliation Queue</h1>
        <div className="flex gap-2 flex-wrap">
          <select
            value={stateFilter}
            onChange={(e) => { setStateFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All States</option>
            <option value="open">Open</option>
            <option value="in_review">In Review</option>
            <option value="escalated">Escalated</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            value={severityFilter}
            onChange={(e) => { setSeverityFilter(e.target.value); setPage(1); }}
            className="rounded-md border border-slate-200 px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>
      ) : items.length === 0 ? (
        <div className="py-12 text-center text-slate-400">No items found.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">State</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Severity</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Impact</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">SLA</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {items.map((item) => {
                const isBreached = item.sla_deadline_at && new Date(item.sla_deadline_at) < new Date();
                const isOpen = !['resolved', 'closed'].includes(item.state);
                return (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3 text-sm text-slate-800">
                      {TYPE_LABELS[item.item_type] ?? item.item_type}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant="secondary" className="capitalize text-xs">
                        {item.state.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={severityVariant(item.severity)} className="capitalize text-xs">
                        {item.severity}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-slate-700">
                      {item.monetary_impact != null ? formatInrLakh(item.monetary_impact) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {item.sla_deadline_at ? (
                        <span className={isBreached && isOpen ? 'text-red-600 font-semibold' : 'text-slate-500'}>
                          {new Date(item.sla_deadline_at).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short',
                          })}
                          {isBreached && isOpen && ' ⚠'}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(item.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                      })}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/reconciliation/${item.id}`}
                        className="text-xs text-blue-600 hover:underline font-medium"
                      >
                        Review →
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-slate-500">
          <span>{total} total items</span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              Previous
            </button>
            <span className="px-3 py-1.5">Page {page} of {totalPages}</span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
