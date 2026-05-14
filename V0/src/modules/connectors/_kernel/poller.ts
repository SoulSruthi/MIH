/**
 * Inngest poller factory — one cron function per connector kind.
 *
 * Each poller:
 *  1. Fetches all 'active' sources of this kind across all orgs
 *  2. For each source: calls connector.pollLeads() → passes to ingest pipeline
 *  3. Updates sources.last_sync_at, last_sync_status, health_score
 *  4. On vendor failure: writes connector_dlq row, decrements health_score
 *
 * Inngest is initialized lazily so the module can be imported in test environments
 * without INNGEST_EVENT_KEY being set.
 */

import { getConnector } from './registry';
import { isOpen, recordFailure, recordSuccess } from './circuit-breaker';
import { applyHealthDelta, HEALTH_DELTA } from './health';

export type PollSourceDeps = {
  /** Returns all active sources for this kind (service-role DB access). */
  fetchActiveSources: (kind: string) => Promise<ActiveSource[]>;
  /** Fetches and decrypts credentials for a source. */
  getCredentials: (credentialId: string) => Promise<Record<string, string>>;
  /** Writes a DLQ row. */
  writeDlq: (row: DlqRow) => Promise<void>;
  /** Applies health update to a source row. */
  updateSourceHealth: (sourceId: string, score: number, state: string, syncStatus: 'success' | 'partial' | 'failed', error?: string) => Promise<void>;
  /** Hands off raw leads to the ingestion pipeline. */
  ingestLeads: (sourceId: string, orgId: string, leads: unknown[]) => Promise<void>;
};

export type ActiveSource = {
  id: string;
  organization_id: string;
  source_kind: string;
  credential_id: string | null;
  config: Record<string, unknown>;
  health_score: number;
  last_sync_at: string | null;
};

export type DlqRow = {
  organization_id: string;
  source_id: string;
  failure_stage: 'fetch' | 'normalize' | 'ingest' | 'dedup' | 'handoff';
  raw_payload?: unknown;
  error_message: string;
  error_code?: string;
};

/**
 * Polls a single source. Handles circuit breaker, health scoring, DLQ.
 * Extracted so it can be unit-tested without Inngest.
 */
export async function pollSource(
  source: ActiveSource,
  deps: PollSourceDeps,
): Promise<void> {
  if (isOpen(source.id)) return; // circuit open — skip until auto-reset

  const connector = getConnector(source.source_kind);
  const since = source.last_sync_at ? new Date(source.last_sync_at) : new Date(0);
  const creds = source.credential_id
    ? await deps.getCredentials(source.credential_id)
    : {};

  let leads: unknown[] = [];
  try {
    leads = await connector.pollLeads(creds, source.config, since);
    recordSuccess(source.id);
  } catch (err) {
    const error = err as Error & { status?: number };
    recordFailure(source.id);

    const isAuth = error.status === 401 || error.status === 403;
    const delta = isAuth ? HEALTH_DELTA.AUTH_FAILURE : HEALTH_DELTA.VENDOR_ERROR;
    const { score, state } = applyHealthDelta(source.health_score, delta);

    await deps.writeDlq({
      organization_id: source.organization_id,
      source_id: source.id,
      failure_stage: 'fetch',
      error_message: error.message,
      error_code: String(error.status ?? 'unknown'),
    });

    await deps.updateSourceHealth(source.id, score, isAuth ? 'revoked' : state, 'failed', error.message);
    return;
  }

  // Ingest — failures here go to DLQ but don't fail the whole poll
  try {
    await deps.ingestLeads(source.id, source.organization_id, leads);
  } catch (err) {
    const error = err as Error;
    await deps.writeDlq({
      organization_id: source.organization_id,
      source_id: source.id,
      failure_stage: 'ingest',
      raw_payload: leads,
      error_message: error.message,
    });
  }

  const { score, state } = applyHealthDelta(source.health_score, HEALTH_DELTA.SUCCESS);
  await deps.updateSourceHealth(source.id, score, state, 'success');
}

/**
 * Returns an Inngest function definition for a given connector kind.
 * The caller must pass their initialized Inngest client to avoid
 * requiring INNGEST_EVENT_KEY at import time.
 */
export function createPollerDefinition(kind: string) {
  return {
    id: `source.${kind}.poll`,
    cron: '*/5 * * * *',
    concurrency: 10,
    kind,
  };
}
