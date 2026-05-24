'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useOrgId } from '@/lib/use-org-id';

// ─── Types ────────────────────────────────────────────────────────────────────

type AnomalyAlert = {
  orgId: string;
  sourceId: string;
  sourceName: string;
  alertType: 'cpl_spike' | 'health_drop' | 'zero_leads';
  severity: 'warning' | 'critical';
  message: string;
  detectedAt: string;
  metadata: Record<string, unknown>;
};

type AnomaliesResponse = {
  alerts: AnomalyAlert[];
  checked_at: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ALERT_TYPE_LABELS: Record<AnomalyAlert['alertType'], string> = {
  cpl_spike: 'CPL Spike',
  health_drop: 'Health Drop',
  zero_leads: 'Zero Leads',
};

function formatCheckedAt(iso: string): string {
  return new Intl.DateTimeFormat('en-IN', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(new Date(iso));
}

// ─── AlertCard ────────────────────────────────────────────────────────────────

function AlertCard({ alert }: { alert: AnomalyAlert }) {
  const isCritical = alert.severity === 'critical';

  return (
    <div className="flex rounded-lg border border-slate-200 overflow-hidden shadow-sm">
      {/* Left colored bar */}
      <div
        className={`w-1 flex-shrink-0 ${isCritical ? 'bg-red-500' : 'bg-amber-400'}`}
      />
      <div className="flex-1 px-4 py-3 space-y-1.5">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="ghost" className="text-xs">
            {ALERT_TYPE_LABELS[alert.alertType]}
          </Badge>
          <Badge
            variant={isCritical ? 'destructive' : 'warning'}
            className="text-xs capitalize"
          >
            <AlertTriangle className="h-3 w-3 mr-0.5" />
            {alert.severity}
          </Badge>
        </div>
        {/* Source name */}
        <p className="text-sm font-semibold text-slate-900">{alert.sourceName}</p>
        {/* Alert message */}
        <p className="text-sm text-slate-600">{alert.message}</p>
        {/* Timestamp */}
        <p className="text-xs text-slate-400">
          Detected: {formatCheckedAt(alert.detectedAt)}
        </p>
      </div>
    </div>
  );
}

// ─── AnomalyAlerts ────────────────────────────────────────────────────────────

export function AnomalyAlerts() {
  const [alerts, setAlerts] = useState<AnomalyAlert[]>([]);
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/anomalies', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnomaliesResponse;
      setAlerts(json.alerts ?? []);
      setCheckedAt(json.checked_at ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load anomaly alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchAlerts();
  }, [fetchAlerts]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold text-slate-900">
            Anomaly Alerts
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void fetchAlerts()}
            disabled={loading}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        {loading && (
          <div className="py-10 text-center text-sm text-slate-500">
            <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-slate-400" />
            Checking for anomalies…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
            <Button
              variant="ghost"
              size="sm"
              className="ml-3"
              onClick={() => void fetchAlerts()}
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && alerts.length === 0 && (
          <div className="py-10 text-center space-y-2">
            <CheckCircle2 className="h-8 w-8 text-emerald-500 mx-auto" />
            <p className="text-sm font-medium text-emerald-700">All systems healthy</p>
            <p className="text-xs text-slate-400">No anomalies detected across active sources.</p>
          </div>
        )}

        {!loading && !error && alerts.length > 0 && (
          <>
            {alerts.map((alert, idx) => (
              <AlertCard key={`${alert.sourceId}-${alert.alertType}-${idx}`} alert={alert} />
            ))}
          </>
        )}

        {checkedAt && !loading && (
          <p className="text-xs text-slate-400 pt-1">
            Checked at: {formatCheckedAt(checkedAt)}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
