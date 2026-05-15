'use client';

import { useState } from 'react';

type SourceState = 'unauthorized' | 'authorized' | 'active' | 'degraded' | 'paused' | 'revoked' | 'error';

type SourceRow = {
  id: string;
  name: string;
  source_type: string;
  display_name: string;
  state: SourceState;
  health_score: number;
  last_sync_at: string | null;
  last_sync_status: string | null;
  connected: boolean;
};

const STATE_BADGE: Record<SourceState, { label: string; className: string }> = {
  unauthorized: { label: 'Not Connected', className: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400' },
  authorized: { label: 'Authorized', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  active: { label: 'Active', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  degraded: { label: 'Degraded', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  paused: { label: 'Paused', className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300' },
  revoked: { label: 'Revoked', className: 'bg-gray-100 text-gray-500 dark:bg-gray-800' },
  error: { label: 'Error', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
};

type Props = {
  source: SourceRow;
  orgId: string;
  onDisconnect?: (sourceId: string) => Promise<void>;
  onTestPing?: (sourceId: string) => Promise<{ ok: boolean; message?: string }>;
};

export function SourceCard({ source, orgId, onDisconnect, onTestPing }: Props) {
  const [pingResult, setPingResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showDisconnectConfirm, setShowDisconnectConfirm] = useState(false);

  const badge = STATE_BADGE[source.state] ?? STATE_BADGE.unauthorized;

  async function handleTestPing() {
    if (!onTestPing) return;
    setPinging(true);
    setPingResult(null);
    try {
      const result = await onTestPing(source.id);
      setPingResult(result);
    } finally {
      setPinging(false);
    }
  }

  async function handleDisconnect() {
    if (!onDisconnect) return;
    setDisconnecting(true);
    try {
      await onDisconnect(source.id);
    } finally {
      setDisconnecting(false);
      setShowDisconnectConfirm(false);
    }
  }

  return (
    <div className="rounded-lg border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-foreground">{source.display_name}</h3>
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.className}`}>
              {badge.label}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">{source.source_type}</p>

          {source.connected && (
            <>
              {/* Health score bar */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Health</span>
                  <span>{source.health_score}/100</span>
                </div>
                <div className="mt-1 h-2 w-full rounded-full bg-muted">
                  <div
                    className={`h-2 rounded-full transition-all ${
                      source.health_score >= 80 ? 'bg-green-500' :
                      source.health_score >= 50 ? 'bg-yellow-500' : 'bg-red-500'
                    }`}
                    style={{ width: `${source.health_score}%` }}
                  />
                </div>
              </div>

              {source.last_sync_at && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Last sync: {new Date(source.last_sync_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  {source.last_sync_status && (
                    <span className={`ml-2 font-medium ${source.last_sync_status === 'ok' ? 'text-green-600' : 'text-red-600'}`}>
                      ({source.last_sync_status})
                    </span>
                  )}
                </p>
              )}

              {pingResult && (
                <p className={`mt-2 text-xs font-medium ${pingResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {pingResult.ok ? '✓ Connected' : `✗ ${pingResult.message ?? 'Connection failed'}`}
                </p>
              )}
            </>
          )}
        </div>

        <div className="flex shrink-0 flex-col gap-2">
          {source.connected ? (
            <>
              <button
                onClick={handleTestPing}
                disabled={pinging}
                className="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors hover:bg-muted disabled:opacity-50"
              >
                {pinging ? 'Testing…' : 'Test Ping'}
              </button>
              <button
                onClick={() => setShowDisconnectConfirm(true)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-50 dark:border-red-900 dark:hover:bg-red-950/30"
              >
                Disconnect
              </button>
            </>
          ) : (
            source.source_type === 'meta_lead_ads' ? (
              <a
                href={`/api/oauth/meta/start?org_id=${orgId}`}
                className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                Connect
              </a>
            ) : (
              <button
                disabled
                className="rounded-md border px-3 py-1.5 text-xs font-medium text-muted-foreground opacity-50"
                title="Coming soon"
              >
                Connect
              </button>
            )
          )}
        </div>
      </div>

      {/* Disconnect confirmation dialog */}
      {showDisconnectConfirm && (
        <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-900 dark:bg-red-950/20">
          <p className="text-sm text-red-700 dark:text-red-400">
            Disconnect <strong>{source.display_name}</strong>? This will stop lead ingestion from this source.
          </p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="rounded-md bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {disconnecting ? 'Disconnecting…' : 'Yes, Disconnect'}
            </button>
            <button
              onClick={() => setShowDisconnectConfirm(false)}
              className="rounded-md border px-3 py-1 text-xs font-medium transition-colors hover:bg-muted"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
