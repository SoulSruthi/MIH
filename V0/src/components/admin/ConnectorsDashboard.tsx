'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Zap, Globe, CheckCircle2, XCircle, RefreshCw, Link2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { ConnectorWithStatus } from '@/app/api/admin/connectors/route';
import { useOrgId } from '@/lib/use-org-id';

type ToastState = { type: 'success' | 'error'; message: string } | null;

function Toast({ toast, onDismiss }: { toast: ToastState; onDismiss: () => void }) {
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(onDismiss, 4000);
    return () => clearTimeout(id);
  }, [toast, onDismiss]);

  if (!toast) return null;

  const isSuccess = toast.type === 'success';
  return (
    <div
      role="status"
      aria-live="polite"
      className={[
        'flex items-center gap-2 rounded-md border px-4 py-3 text-sm',
        isSuccess
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
          : 'border-red-200 bg-red-50 text-red-800',
      ].join(' ')}
    >
      {isSuccess ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
      ) : (
        <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
      )}
      {toast.message}
    </div>
  );
}

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
  onMetaConnect?: () => Promise<void>;
  connectingMeta?: boolean;
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

function ConnectorCard({ connector, onToggle, toggling, onMetaConnect, connectingMeta }: ConnectorCardProps) {
  const handleToggle = () => {
    void onToggle(connector.id, !connector.is_enabled);
  };

  const isMetaConnector = connector.id === 'facebook_ads';

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

        {/* Meta OAuth: Connected badge or Connect button */}
        {isMetaConnector && (
          connector.has_credentials ? (
            <Badge variant="success" className="w-full justify-center text-xs py-1">
              <CheckCircle2 className="h-3 w-3 mr-1" />
              Connected
            </Badge>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full bg-blue-600 hover:bg-blue-700"
              onClick={() => { void onMetaConnect?.(); }}
              disabled={connectingMeta}
            >
              {connectingMeta ? (
                <>
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                  Connecting…
                </>
              ) : (
                <>
                  <Link2 className="h-3.5 w-3.5 mr-1" />
                  Connect with Meta
                </>
              )}
            </Button>
          )
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
  const [connectingMeta, setConnectingMeta] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const searchParams = useSearchParams();

  // Show success toast if redirected back after Meta OAuth
  useEffect(() => {
    const connected = searchParams.get('connected');
    if (connected === 'meta') {
      setToast({ type: 'success', message: 'Meta / Facebook Ads connected successfully!' });
    }
  }, [searchParams]);

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

  const handleMetaConnect = useCallback(async () => {
    setConnectingMeta(true);
    try {
      const res = await fetch('/api/admin/connectors/meta-oauth', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as { url: string; error?: string };
      if (!json.url) throw new Error(json.error ?? 'No OAuth URL returned');
      window.location.href = json.url;
    } catch (err) {
      setToast({ type: 'error', message: err instanceof Error ? err.message : 'Failed to start Meta OAuth' });
      setConnectingMeta(false);
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
      {toast && (
        <Toast toast={toast} onDismiss={() => setToast(null)} />
      )}

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
                onMetaConnect={connector.id === 'facebook_ads' ? handleMetaConnect : undefined}
                connectingMeta={connector.id === 'facebook_ads' ? connectingMeta : false}
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
