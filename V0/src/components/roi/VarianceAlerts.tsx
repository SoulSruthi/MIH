'use client';

import { useEffect, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const ORG_ID = 'demo-org-id';

type Alert = {
  id: string;
  alert_type: string;
  severity: string;
  period_start: string;
  period_end: string;
  context: Record<string, unknown>;
  resolved_at: string | null;
  created_at: string;
};

const SEVERITY_CLASSES: Record<string, string> = {
  info: 'bg-blue-50 text-blue-700',
  warning: 'bg-amber-50 text-amber-700',
  critical: 'bg-red-50 text-red-700',
};

const TYPE_LABELS: Record<string, string> = {
  spend_overrun: 'Spend Overrun',
  booking_shortfall: 'Booking Shortfall',
  cpb_spike: 'CPB Spike',
  source_underperforming: 'Source Underperforming',
};

export function VarianceAlerts() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const url = showResolved ? '/api/variance/alerts?resolved=true' : '/api/variance/alerts?resolved=false';
      const res = await fetch(url, { headers: { 'x-org-id': ORG_ID } });
      if (res.ok) {
        const d = (await res.json()) as { alerts: Alert[] };
        setAlerts(d.alerts ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, [showResolved]);

  useEffect(() => { void fetchAlerts(); }, [fetchAlerts]);

  const handleResolve = async (id: string) => {
    setResolving(id);
    try {
      const res = await fetch(`/api/variance/alerts/${id}/resolve`, {
        method: 'POST',
        headers: { 'x-org-id': ORG_ID },
      });
      if (res.ok) await fetchAlerts();
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {loading ? 'Loading…' : `${alerts.length} alert${alerts.length !== 1 ? 's' : ''}`}
        </p>
        <div className="flex gap-2">
          <Button size="sm" variant={showResolved ? 'outline' : 'default'} onClick={() => setShowResolved(false)}>
            Open
          </Button>
          <Button size="sm" variant={showResolved ? 'default' : 'outline'} onClick={() => setShowResolved(true)}>
            Resolved
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="space-y-3">{[...Array(3)].map((_, i) => <div key={i} className="h-16 rounded-xl bg-slate-100 animate-pulse" />)}</div>
      ) : alerts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 py-16 text-center text-slate-400 text-sm">
          {showResolved ? 'No resolved alerts.' : 'No open alerts. Great!'}
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <Card key={alert.id} className="rounded-xl shadow-sm border-slate-200">
              <CardContent className="px-5 py-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${SEVERITY_CLASSES[alert.severity] ?? ''}`}>
                        {alert.severity}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {TYPE_LABELS[alert.alert_type] ?? alert.alert_type}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500">
                      {alert.period_start} → {alert.period_end}
                    </p>
                    {Object.keys(alert.context).length > 0 && (
                      <p className="text-xs text-slate-400 font-mono truncate">
                        {JSON.stringify(alert.context).slice(0, 80)}…
                      </p>
                    )}
                  </div>
                  {!alert.resolved_at && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => void handleResolve(alert.id)}
                      disabled={resolving === alert.id}
                    >
                      {resolving === alert.id ? 'Resolving…' : 'Resolve'}
                    </Button>
                  )}
                  {alert.resolved_at && (
                    <span className="text-xs text-emerald-600 font-medium">
                      Resolved {new Date(alert.resolved_at).toLocaleDateString('en-IN')}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
