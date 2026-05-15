'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Globe, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConnectorWithStatus } from '@/app/api/admin/connectors/route';

type ConnectorsResponse = {
  connectors: ConnectorWithStatus[];
};

type ToggleResponse = {
  ok?: boolean;
  error?: string;
  data?: { id: string; connector_id: string; is_enabled: boolean };
};

// ─── ConnectorCard ────────────────────────────────────────────────────────────

type ConnectorCardProps = {
  connector: ConnectorWithStatus;
  onToggle: (id: string, next: boolean) => Promise<void>;
  toggling: boolean;
};

function ConnectorInitials({ name }: { name: string }) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');

  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-sm font-bold flex-shrink-0">
      {initials}
    </div>
  );
}

function ConnectorCard({ connector, onToggle, toggling }: ConnectorCardProps) {
  const handleToggle = () => {
    void onToggle(connector.id, !connector.is_enabled);
  };

  const healthLabel =
    connector.health_score != null
      ? `Health: ${connector.health_score}%`
      : null;

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <ConnectorInitials name={connector.display_name} />
          <div className="flex-1 min-w-0">
            <CardTitle className="text-sm font-semibold text-slate-900 truncate">
              {connector.display_name}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {connector.supports_auto_fetch ? (
                <Badge variant="info" className="text-xs">
                  <Zap className="h-3 w-3 mr-0.5" />
                  Auto-fetch
                </Badge>
              ) : (
                <Badge variant="ghost" className="text-xs">
                  Manual
                </Badge>
              )}
              {connector.supports_spend_tracking && (
                <Badge variant="success" className="text-xs">
                  Spend tracking
                </Badge>
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col justify-end gap-3">
        {/* Status row */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          {connector.is_enabled ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-emerald-700 font-medium">Enabled</span>
            </>
          ) : (
            <>
              <XCircle className="h-3.5 w-3.5 text-slate-400" />
              <span>Disabled</span>
            </>
          )}
          {healthLabel && (
            <span className="ml-auto">{healthLabel}</span>
          )}
        </div>

        {/* Last sync */}
        {connector.last_synced_at && (
          <p className="text-xs text-slate-400">
            Last sync:{' '}
            {new Intl.DateTimeFormat('en-IN', {
              dateStyle: 'short',
              timeStyle: 'short',
            }).format(new Date(connector.last_synced_at))}
          </p>
        )}

        {/* Sync error */}
        {connector.last_sync_error && (
          <p className="text-xs text-red-600 truncate" title={connector.last_sync_error}>
            Error: {connector.last_sync_error}
          </p>
        )}

        {/* Docs link */}
        {connector.vendor_docs_url && (
          <a
            href={connector.vendor_docs_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-blue-600 hover:underline"
          >
            <Globe className="inline h-3 w-3 mr-0.5" />
            Docs
          </a>
        )}

        {/* Toggle button */}
        <Button
          variant={connector.is_enabled ? 'outline' : 'default'}
          size="sm"
          className="w-full"
          onClick={handleToggle}
          disabled={toggling}
        >
          {toggling ? (
            <>
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              Saving…
            </>
          ) : connector.is_enabled ? (
            'Disable'
          ) : (
            'Enable'
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

// ─── ConnectorsDashboard ──────────────────────────────────────────────────────

export function ConnectorsDashboard() {
  const [connectors, setConnectors] = useState<ConnectorWithStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const fetchConnectors = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/connectors', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as ConnectorsResponse;
      setConnectors(json.connectors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load connectors');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchConnectors();
  }, [fetchConnectors]);

  const handleToggle = useCallback(async (connectorId: string, nextEnabled: boolean) => {
    // Optimistic update
    setConnectors((prev) =>
      prev.map((c) => (c.id === connectorId ? { ...c, is_enabled: nextEnabled } : c)),
    );
    setTogglingIds((prev) => new Set(prev).add(connectorId));

    try {
      const res = await fetch('/api/admin/connectors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({ connector_id: connectorId, is_enabled: nextEnabled }),
      });

      const json = (await res.json()) as ToggleResponse;
      if (!res.ok || !json.ok) {
        // Revert on error
        setConnectors((prev) =>
          prev.map((c) => (c.id === connectorId ? { ...c, is_enabled: !nextEnabled } : c)),
        );
        setError(json.error ?? `Failed to toggle connector`);
      }
    } catch (err) {
      // Revert on error
      setConnectors((prev) =>
        prev.map((c) => (c.id === connectorId ? { ...c, is_enabled: !nextEnabled } : c)),
      );
      setError(err instanceof Error ? err.message : 'Toggle failed');
    } finally {
      setTogglingIds((prev) => {
        const next = new Set(prev);
        next.delete(connectorId);
        return next;
      });
    }
  }, []);

  // Split into auto-fetch (digital) vs manual (portal/manual)
  const autoFetch = connectors.filter((c) => c.supports_auto_fetch);
  const manual = connectors.filter((c) => !c.supports_auto_fetch);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading connectors…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <Button variant="ghost" size="sm" className="ml-3" onClick={() => void fetchConnectors()}>
          Retry
        </Button>
      </div>
    );
  }

  if (connectors.length === 0) {
    return (
      <div className="rounded-md border border-slate-200 bg-slate-50 py-16 text-center text-sm text-slate-500">
        No connectors configured. Contact your administrator.
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Auto-fetch section */}
      {autoFetch.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">
              Digital Connectors
            </h2>
            <Badge variant="info">Auto-fetch</Badge>
            <span className="text-sm text-slate-400">({autoFetch.length})</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These connectors automatically pull leads from your digital ad platforms.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {autoFetch.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                onToggle={handleToggle}
                toggling={togglingIds.has(connector.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Manual / portal section */}
      {manual.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-base font-semibold text-slate-800">
              Portal / Manual Connectors
            </h2>
            <Badge variant="ghost">Manual</Badge>
            <span className="text-sm text-slate-400">({manual.length})</span>
          </div>
          <p className="text-sm text-slate-500 mb-4">
            These sources require manual lead uploads or webhook-based ingestion.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {manual.map((connector) => (
              <ConnectorCard
                key={connector.id}
                connector={connector}
                onToggle={handleToggle}
                toggling={togglingIds.has(connector.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
