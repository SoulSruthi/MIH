'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ORG_ID = 'demo-org-id';

type EventKind =
  | 'completed'
  | 'scheduled'
  | 'no_show'
  | 'cancelled'
  | 'walk_in_unscheduled';

type SiteVisit = {
  id: string;
  event_kind: EventKind;
  project_id: string | null;
  is_fast_track: boolean | null;
  scheduled_at: string | null;
  completed_at: string | null;
  cluster_id: string | null;
  identity_clusters?: { id: string; cluster_type: string; state: string } | null;
};

type PortalTarget = {
  id: string;
  source_id: string;
  project_id: string;
  target_month: string;
  target_count: number;
  actual_count: number | null;
  is_breached: boolean | null;
};

const EVENT_KIND_BADGE: Record<EventKind, string> = {
  completed: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  scheduled: 'bg-blue-100 text-blue-800 border-blue-200',
  no_show: 'bg-red-100 text-red-800 border-red-200',
  cancelled: 'bg-slate-100 text-slate-600 border-slate-200',
  walk_in_unscheduled: 'bg-orange-100 text-orange-800 border-orange-200',
};

function eventKindLabel(kind: EventKind): string {
  const labels: Record<EventKind, string> = {
    completed: 'Completed',
    scheduled: 'Scheduled',
    no_show: 'No Show',
    cancelled: 'Cancelled',
    walk_in_unscheduled: 'Walk-in',
  };
  return labels[kind] ?? kind;
}

type PortalTargetForm = {
  source_id: string;
  project_id: string;
  target_month: string;
  target_count: string;
};

const DEFAULT_PORTAL_FORM: PortalTargetForm = {
  source_id: '',
  project_id: '',
  target_month: new Date().toISOString().slice(0, 7),
  target_count: '',
};

export function SiteVisitDashboard() {
  const [visits, setVisits] = useState<SiteVisit[]>([]);
  const [portalTargets, setPortalTargets] = useState<PortalTarget[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPortalForm, setShowPortalForm] = useState(false);
  const [portalForm, setPortalForm] = useState<PortalTargetForm>(DEFAULT_PORTAL_FORM);
  const [settingTarget, setSettingTarget] = useState(false);
  const [portalFormError, setPortalFormError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [visitsRes, targetsRes] = await Promise.all([
        fetch('/api/site-visits?limit=50', { headers: { 'x-org-id': ORG_ID } }),
        fetch('/api/site-visits/portal-targets', { headers: { 'x-org-id': ORG_ID } }),
      ]);

      if (visitsRes.ok) {
        const d = (await visitsRes.json()) as { site_visits: SiteVisit[] };
        setVisits(d.site_visits ?? []);
      } else {
        setError(`Failed to load site visits (HTTP ${visitsRes.status}).`);
      }

      if (targetsRes.ok) {
        const d = (await targetsRes.json()) as { portal_targets: PortalTarget[] };
        setPortalTargets(d.portal_targets ?? []);
      }
    } catch {
      setError('Failed to load site visit data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleSetPortalTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    setSettingTarget(true);
    setPortalFormError(null);
    try {
      const res = await fetch('/api/site-visits/portal-targets', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': ORG_ID,
        },
        body: JSON.stringify({
          source_id: portalForm.source_id.trim(),
          project_id: portalForm.project_id.trim(),
          target_month: portalForm.target_month,
          target_count: parseInt(portalForm.target_count, 10),
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setPortalFormError(err.error ?? 'Failed to set target.');
        return;
      }
      setPortalForm(DEFAULT_PORTAL_FORM);
      setShowPortalForm(false);
      await fetchData();
    } catch {
      setPortalFormError('Failed to set portal target.');
    } finally {
      setSettingTarget(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Summary stats
  const completed = visits.filter((v) => v.event_kind === 'completed').length;
  const scheduled = visits.filter((v) => v.event_kind === 'scheduled').length;
  const noShow = visits.filter((v) => v.event_kind === 'no_show').length;
  const cancelled = visits.filter((v) => v.event_kind === 'cancelled').length;
  const fastTrack = visits.filter((v) => v.is_fast_track).length;

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { label: 'Completed', value: completed, color: 'text-emerald-700' },
          { label: 'Scheduled', value: scheduled, color: 'text-blue-700' },
          { label: 'No Shows', value: noShow, color: 'text-red-700' },
          { label: 'Cancelled', value: cancelled, color: 'text-slate-500' },
          { label: 'Fast Track', value: fastTrack, color: 'text-amber-700', highlight: true },
        ].map((stat) => (
          <Card
            key={stat.label}
            className={`rounded-xl shadow-sm border-slate-200 ${stat.highlight ? 'ring-1 ring-amber-200' : ''}`}
          >
            <CardContent className="px-4 py-3">
              {loading ? (
                <div className="h-8 w-12 rounded bg-slate-100 animate-pulse" />
              ) : (
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              )}
              <p className="text-xs text-slate-500 mt-0.5">{stat.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Portal SLA targets */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Portal SLA Targets
            </CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowPortalForm((v) => !v);
                setPortalFormError(null);
              }}
            >
              {showPortalForm ? 'Cancel' : 'Set Portal Target'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {showPortalForm && (
            <div className="px-5 py-4 border-b border-slate-100">
              <form onSubmit={(e) => void handleSetPortalTarget(e)} className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Source ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={portalForm.source_id}
                      onChange={(e) =>
                        setPortalForm((f) => ({ ...f, source_id: e.target.value }))
                      }
                      placeholder="e.g. 99acres"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Project ID <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={portalForm.project_id}
                      onChange={(e) =>
                        setPortalForm((f) => ({ ...f, project_id: e.target.value }))
                      }
                      placeholder="UUID"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Target Month <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="month"
                      required
                      value={portalForm.target_month}
                      onChange={(e) =>
                        setPortalForm((f) => ({ ...f, target_month: e.target.value }))
                      }
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                      Target Count <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      value={portalForm.target_count}
                      onChange={(e) =>
                        setPortalForm((f) => ({ ...f, target_count: e.target.value }))
                      }
                      placeholder="e.g. 20"
                      className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                {portalFormError && (
                  <p className="text-sm text-red-600">{portalFormError}</p>
                )}
                <div className="flex gap-3">
                  <Button type="submit" size="sm" disabled={settingTarget}>
                    {settingTarget ? 'Saving…' : 'Save Target'}
                  </Button>
                </div>
              </form>
            </div>
          )}

          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : portalTargets.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No portal targets set for this month.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Target Month</TableHead>
                  <TableHead className="text-right">Target</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Pacing %</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {portalTargets.map((t) => {
                  const actual = t.actual_count ?? 0;
                  const pacing =
                    t.target_count > 0
                      ? Math.round((actual / t.target_count) * 100)
                      : null;
                  return (
                    <TableRow
                      key={t.id}
                      className={t.is_breached ? 'bg-red-50' : undefined}
                    >
                      <TableCell className="font-mono text-sm">
                        {t.source_id.length > 20
                          ? `${t.source_id.slice(0, 20)}…`
                          : t.source_id}
                      </TableCell>
                      <TableCell className="text-sm">{t.target_month}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {t.target_count}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        {t.actual_count ?? 0}
                      </TableCell>
                      <TableCell className="text-right">
                        {pacing != null ? (
                          <span
                            className={`text-sm font-medium ${
                              t.is_breached ? 'text-red-700' : 'text-slate-700'
                            }`}
                          >
                            {pacing}%
                          </span>
                        ) : (
                          <span className="text-sm text-slate-400">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Site visits table */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            Recent Site Visits ({visits.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : visits.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No site visits found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kind</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Fast Track</TableHead>
                  <TableHead>Scheduled At</TableHead>
                  <TableHead>Completed At</TableHead>
                  <TableHead>Cluster</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visits.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                          EVENT_KIND_BADGE[v.event_kind] ??
                          'bg-slate-100 text-slate-600 border-slate-200'
                        }`}
                      >
                        {eventKindLabel(v.event_kind)}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {v.project_id
                        ? `${v.project_id.slice(0, 8)}…`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      {v.is_fast_track ? (
                        <Badge variant="warning">Fast Track</Badge>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDate(v.scheduled_at)}
                    </TableCell>
                    <TableCell className="text-xs text-slate-600">
                      {formatDate(v.completed_at)}
                    </TableCell>
                    <TableCell>
                      {v.cluster_id ? (
                        <Link
                          href={`/leads/clusters`}
                          className="font-mono text-xs text-blue-600 hover:underline"
                          title={v.cluster_id}
                        >
                          {v.cluster_id.slice(0, 8)}…
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
