'use client';

import { useEffect, useState, useCallback } from 'react';
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
import { formatInrLakh } from '@/lib/format-inr';

const ORG_ID = 'demo-org-id';

type LifecycleStage =
  | 'pre_launch'
  | 'launch'
  | 'mid_construction'
  | 'near_handover'
  | 'handover_complete';

type Project = {
  id: string;
  display_name: string;
  lifecycle_stage: LifecycleStage | null;
  fy_booking_target_value: number | null;
  fy_marketing_budget: number | null;
  marketing_spend_pct: number | null;
  project_stage_history?: Array<{
    id: string;
    lifecycle_stage: string;
    changed_at: string;
    notes: string | null;
  }>;
};

type PredominantSource = {
  source_id: string;
  bookings_count: number;
  bookings_value: number | null;
};

const LIFECYCLE_STAGES: { value: LifecycleStage; label: string }[] = [
  { value: 'pre_launch', label: 'Pre-Launch' },
  { value: 'launch', label: 'Launch' },
  { value: 'mid_construction', label: 'Mid Construction' },
  { value: 'near_handover', label: 'Near Handover' },
  { value: 'handover_complete', label: 'Handover Complete' },
];

const STAGE_BADGE: Record<LifecycleStage, 'secondary' | 'info' | 'warning' | 'destructive' | 'success'> = {
  pre_launch: 'secondary',
  launch: 'info',
  mid_construction: 'warning',
  near_handover: 'destructive',
  handover_complete: 'success',
};

function stageLabel(stage: LifecycleStage | null | string): string {
  if (!stage) return '—';
  return LIFECYCLE_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

interface ProjectDetailProps {
  projectId: string;
}

export function ProjectDetail({ projectId }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [sources, setSources] = useState<PredominantSource[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [transitionStage, setTransitionStage] = useState<LifecycleStage | ''>('');
  const [transitioning, setTransitioning] = useState(false);
  const [transitionError, setTransitionError] = useState<string | null>(null);
  const [showTransitionForm, setShowTransitionForm] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projectRes, sourcesRes] = await Promise.all([
        fetch(`/api/projects/${projectId}`, { headers: { 'x-org-id': ORG_ID } }),
        fetch(`/api/projects/${projectId}/predominant-source`, {
          headers: { 'x-org-id': ORG_ID },
        }),
      ]);

      if (!projectRes.ok) {
        setError(`Project not found (HTTP ${projectRes.status}).`);
        return;
      }

      const projectData = (await projectRes.json()) as { project: Project };
      setProject(projectData.project);

      if (sourcesRes.ok) {
        const sourcesData = (await sourcesRes.json()) as {
          sources?: PredominantSource[];
          predominant_sources?: PredominantSource[];
        };
        setSources(
          sourcesData.sources ?? sourcesData.predominant_sources ?? [],
        );
      }
    } catch {
      setError('Failed to load project details.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleTransition = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transitionStage) return;
    setTransitioning(true);
    setTransitionError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': ORG_ID,
        },
        body: JSON.stringify({ lifecycle_stage: transitionStage }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setTransitionError(err.error ?? 'Failed to update stage.');
        return;
      }
      setShowTransitionForm(false);
      setTransitionStage('');
      await fetchData();
    } catch {
      setTransitionError('Failed to update stage.');
    } finally {
      setTransitioning(false);
    }
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  if (!project) return null;

  const totalBookings = sources.reduce((sum, s) => sum + s.bookings_count, 0);

  // Compute budget if not provided directly
  const fyMarketingBudget =
    project.fy_marketing_budget ??
    (project.fy_booking_target_value != null && project.marketing_spend_pct != null
      ? Math.round((project.fy_booking_target_value * project.marketing_spend_pct) / 100)
      : null);

  const currentStage = project.lifecycle_stage;
  const availableStages = LIFECYCLE_STAGES.filter((s) => s.value !== currentStage);

  return (
    <div className="space-y-6">
      {/* Project info */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Project Info</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Display Name
              </p>
              <p className="mt-1 text-base font-semibold text-slate-900">{project.display_name}</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Lifecycle Stage
              </p>
              <div className="mt-1">
                {currentStage ? (
                  <Badge variant={STAGE_BADGE[currentStage] ?? 'secondary'}>
                    {stageLabel(currentStage)}
                  </Badge>
                ) : (
                  <span className="text-sm text-slate-400">—</span>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                FY Booking Target
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatInrLakh(project.fy_booking_target_value)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                FY Marketing Budget
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {formatInrLakh(fyMarketingBudget)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Marketing Spend %
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-900">
                {project.marketing_spend_pct != null
                  ? `${project.marketing_spend_pct}%`
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stage transition */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Stage Transition</CardTitle>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setShowTransitionForm((v) => !v);
                setTransitionError(null);
              }}
            >
              {showTransitionForm ? 'Cancel' : 'Change Stage'}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="mb-4">
            <p className="text-xs text-slate-500 mb-1">Current Stage</p>
            {currentStage ? (
              <Badge variant={STAGE_BADGE[currentStage] ?? 'secondary'}>
                {stageLabel(currentStage)}
              </Badge>
            ) : (
              <span className="text-sm text-slate-400">Not set</span>
            )}
          </div>

          {showTransitionForm && (
            <form onSubmit={(e) => void handleTransition(e)} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                  New Stage
                </label>
                <select
                  value={transitionStage}
                  onChange={(e) => setTransitionStage(e.target.value as LifecycleStage | '')}
                  required
                  className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">— Select new stage —</option>
                  {availableStages.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              {transitionError && (
                <p className="text-sm text-red-600">{transitionError}</p>
              )}
              <Button type="submit" size="sm" disabled={transitioning || !transitionStage}>
                {transitioning ? 'Updating…' : 'Apply Transition'}
              </Button>
            </form>
          )}

          {/* Stage history */}
          {(project.project_stage_history?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
                Stage History
              </p>
              <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
                {project.project_stage_history!.map((h) => (
                  <div
                    key={h.id}
                    className="flex items-center justify-between px-4 py-2.5 bg-white"
                  >
                    <span className="text-sm text-slate-700">{stageLabel(h.lifecycle_stage)}</span>
                    <span className="text-xs text-slate-400">{formatDate(h.changed_at)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Predominant sources */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            Predominant Booking Sources
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {sources.length === 0 ? (
            <div className="py-10 text-center text-slate-400 text-sm">
              No source data available.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Source ID</TableHead>
                  <TableHead className="text-right">Bookings</TableHead>
                  <TableHead className="text-right">% of Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.map((s, i) => {
                  const pct =
                    totalBookings > 0
                      ? ((s.bookings_count / totalBookings) * 100).toFixed(1)
                      : '—';
                  return (
                    <TableRow key={s.source_id}>
                      <TableCell className="text-xs text-slate-400 w-8">{i + 1}</TableCell>
                      <TableCell className="font-mono text-sm">{s.source_id}</TableCell>
                      <TableCell className="text-right text-sm font-medium">
                        {s.bookings_count}
                      </TableCell>
                      <TableCell className="text-right text-sm text-slate-600">
                        {pct !== '—' ? `${pct}%` : '—'}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
