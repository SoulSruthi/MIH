'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useOrgId } from '@/lib/use-org-id';

type Touchpoint = {
  source_id: string;
  touch_at: string;
  channel?: string | null;
};

type AttributionExplanation = {
  conversion_event: {
    id: string;
    event_code: string;
    occurred_at: string;
    cluster_id: string | null;
  };
  decision: {
    winning_source_id: string | null;
    touch_at: string | null;
    rule_applied: string | null;
  };
  computation_inputs: {
    touchpoints_considered: Touchpoint[];
    cp_block_fired: boolean;
    household_rule_fired: boolean;
  };
};

interface AttributionExplainProps {
  conversionEventId: string;
}

export function AttributionExplain({ conversionEventId }: AttributionExplainProps) {
  const orgId = useOrgId();
  const [data, setData] = useState<AttributionExplanation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchExplain = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/attribution/explain/${conversionEventId}`,
        { headers: { 'x-org-id': orgId } },
      );
      if (!res.ok) {
        setError(`Could not load explanation (HTTP ${res.status}).`);
        return;
      }
      const d = (await res.json()) as AttributionExplanation;
      setData(d);
    } catch {
      setError('Failed to load attribution explanation.');
    } finally {
      setLoading(false);
    }
  }, [conversionEventId]);

  useEffect(() => {
    void fetchExplain();
  }, [fetchExplain]);

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

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-slate-100 animate-pulse" />
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

  if (!data) return null;

  const { conversion_event, decision, computation_inputs } = data;

  return (
    <div className="space-y-6">
      {/* Conversion event details */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            Conversion Event
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Event Code
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">
                {conversion_event.event_code}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Occurred At
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {formatDate(conversion_event.occurred_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Cluster
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {conversion_event.cluster_id
                  ? `${conversion_event.cluster_id.slice(0, 12)}…`
                  : '—'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Attribution decision */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            Attribution Decision
          </CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Winning Source ID
              </p>
              <p className="mt-1 font-mono text-sm text-slate-900">
                {decision.winning_source_id ?? '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Touch At
              </p>
              <p className="mt-1 text-sm text-slate-900">
                {formatDate(decision.touch_at)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Rule Applied
              </p>
              <Badge variant="info" className="mt-1">
                {decision.rule_applied ?? 'unknown'}
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Computation inputs */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">
              Computation Inputs
            </CardTitle>
            <div className="flex items-center gap-2">
              {computation_inputs.cp_block_fired && (
                <Badge variant="warning">CP Block Fired</Badge>
              )}
              {computation_inputs.household_rule_fired && (
                <Badge variant="secondary">Household Rule</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-5 py-4">
          <div className="mb-4 grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                CP Block Fired
              </p>
              <Badge
                variant={computation_inputs.cp_block_fired ? 'warning' : 'outline'}
                className="mt-1"
              >
                {computation_inputs.cp_block_fired ? 'Yes' : 'No'}
              </Badge>
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
                Household Rule Fired
              </p>
              <Badge
                variant={computation_inputs.household_rule_fired ? 'secondary' : 'outline'}
                className="mt-1"
              >
                {computation_inputs.household_rule_fired ? 'Yes' : 'No'}
              </Badge>
            </div>
          </div>

          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
            Touchpoints Considered (
            {computation_inputs.touchpoints_considered.length})
          </p>
          {computation_inputs.touchpoints_considered.length === 0 ? (
            <p className="text-sm text-slate-400">No touchpoints recorded.</p>
          ) : (
            <div className="divide-y divide-slate-100 rounded-lg border border-slate-200 overflow-hidden">
              {computation_inputs.touchpoints_considered.map((tp, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between px-4 py-2.5 bg-white hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs w-5 text-center text-slate-400 font-medium">
                      {i + 1}
                    </span>
                    <span className="font-mono text-sm text-slate-900">
                      {tp.source_id}
                    </span>
                    {tp.channel && (
                      <Badge variant="ghost">{tp.channel}</Badge>
                    )}
                  </div>
                  <span className="text-xs text-slate-500">
                    {formatDate(tp.touch_at)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
