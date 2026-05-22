'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatInrLakh } from '@/lib/format-inr';
import { useOrgId } from '@/lib/use-org-id';

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
  marketing_spend_pct: number | null;
};

const LIFECYCLE_STAGES: { value: LifecycleStage; label: string }[] = [
  { value: 'pre_launch', label: 'Pre-Launch' },
  { value: 'launch', label: 'Launch' },
  { value: 'mid_construction', label: 'Mid Construction' },
  { value: 'near_handover', label: 'Near Handover' },
  { value: 'handover_complete', label: 'Handover Complete' },
];

const STAGE_BADGE_CLASSES: Record<LifecycleStage, string> = {
  pre_launch: 'bg-slate-100 text-slate-700 border-slate-200',
  launch: 'bg-blue-100 text-blue-800 border-blue-200',
  mid_construction: 'bg-amber-100 text-amber-800 border-amber-200',
  near_handover: 'bg-orange-100 text-orange-800 border-orange-200',
  handover_complete: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function stageBadgeClass(stage: LifecycleStage | null): string {
  if (!stage) return 'bg-slate-100 text-slate-500 border-slate-200';
  return STAGE_BADGE_CLASSES[stage] ?? 'bg-slate-100 text-slate-700 border-slate-200';
}

function stageLabel(stage: LifecycleStage | null): string {
  if (!stage) return '—';
  return LIFECYCLE_STAGES.find((s) => s.value === stage)?.label ?? stage;
}

function computeFyMarketingBudget(
  fyBookingTargetValue: number | null,
  marketingSpendPct: number | null,
): number | null {
  if (fyBookingTargetValue == null || marketingSpendPct == null) return null;
  return Math.round((fyBookingTargetValue * marketingSpendPct) / 100);
}

type CreateFormState = {
  display_name: string;
  lifecycle_stage: LifecycleStage | '';
  fy_booking_target_value: string;
  marketing_spend_pct: string;
};

const DEFAULT_FORM: CreateFormState = {
  display_name: '',
  lifecycle_stage: '',
  fy_booking_target_value: '',
  marketing_spend_pct: '',
};

export function ProjectsDashboard() {
  const orgId = useOrgId();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CreateFormState>(DEFAULT_FORM);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/projects', {
        headers: { 'x-org-id': orgId },
      });
      if (!res.ok) {
        setError(`Failed to load projects (HTTP ${res.status}).`);
        return;
      }
      const d = (await res.json()) as { projects: Project[] };
      setProjects(d.projects ?? []);
    } catch {
      setError('Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const body: Record<string, unknown> = {
        display_name: form.display_name.trim(),
      };
      if (form.lifecycle_stage) body.lifecycle_stage = form.lifecycle_stage;
      if (form.fy_booking_target_value)
        body.fy_booking_target_value = parseInt(form.fy_booking_target_value, 10);
      if (form.marketing_spend_pct)
        body.marketing_spend_pct = parseFloat(form.marketing_spend_pct);

      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': orgId,
        },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = (await res.json()) as { error?: string };
        setCreateError(err.error ?? 'Failed to create project.');
        return;
      }

      setForm(DEFAULT_FORM);
      setShowForm(false);
      await fetchProjects();
    } catch {
      setCreateError('Failed to create project.');
    } finally {
      setCreating(false);
    }
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${projects.length} project${projects.length !== 1 ? 's' : ''}`}
        </p>
        <Button
          size="sm"
          onClick={() => {
            setShowForm((v) => !v);
            setCreateError(null);
          }}
        >
          {showForm ? 'Cancel' : 'Create Project'}
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="py-3 px-5 border-b">
            <CardTitle className="text-sm font-medium text-slate-600">New Project</CardTitle>
          </CardHeader>
          <CardContent className="px-5 py-4">
            <form onSubmit={(e) => void handleCreate(e)} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Display Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={form.display_name}
                    onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                    placeholder="e.g. Sunrise Heights Phase 2"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Lifecycle Stage
                  </label>
                  <select
                    value={form.lifecycle_stage}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        lifecycle_stage: e.target.value as LifecycleStage | '',
                      }))
                    }
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="">— Select stage —</option>
                    {LIFECYCLE_STAGES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    FY Booking Target Value (paise)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.fy_booking_target_value}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, fy_booking_target_value: e.target.value }))
                    }
                    placeholder="e.g. 500000000000"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1">
                    Marketing Spend %
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={form.marketing_spend_pct}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, marketing_spend_pct: e.target.value }))
                    }
                    placeholder="e.g. 2.5"
                    className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {createError && (
                <p className="text-sm text-red-600">{createError}</p>
              )}

              <div className="flex gap-3 pt-1">
                <Button type="submit" size="sm" disabled={creating}>
                  {creating ? 'Creating…' : 'Create Project'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowForm(false);
                    setForm(DEFAULT_FORM);
                    setCreateError(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Projects grid */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-40 rounded-xl bg-slate-100 animate-pulse" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          No projects yet. Create your first project above.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const budget = computeFyMarketingBudget(
              p.fy_booking_target_value,
              p.marketing_spend_pct,
            );
            return (
              <Link key={p.id} href={`/projects/${p.id}`}>
                <Card className="rounded-xl shadow-sm border-slate-200 hover:shadow-md hover:border-blue-200 transition-all cursor-pointer h-full">
                  <CardContent className="px-5 py-4 space-y-3">
                    <div>
                      <h3 className="font-semibold text-slate-900 text-base leading-snug">
                        {p.display_name}
                      </h3>
                    </div>
                    <div>
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stageBadgeClass(p.lifecycle_stage)}`}
                      >
                        {stageLabel(p.lifecycle_stage)}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-1">
                      <div>
                        <p className="text-xs text-slate-500">FY Marketing Budget</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          {formatInrLakh(budget)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Spend %</p>
                        <p className="text-sm font-semibold text-slate-900 mt-0.5">
                          {p.marketing_spend_pct != null
                            ? `${p.marketing_spend_pct}%`
                            : '—'}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
