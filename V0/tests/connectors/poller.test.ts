import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pollSource } from '../../src/modules/connectors/_kernel/poller.js';
import { registerConnector, _resetRegistry } from '../../src/modules/connectors/_kernel/registry.js';
import { _resetAll as resetBreakers } from '../../src/modules/connectors/_kernel/circuit-breaker.js';
import type { SourceConnector } from '../../src/modules/connectors/_kernel/types.js';
import type { ActiveSource, PollSourceDeps } from '../../src/modules/connectors/_kernel/poller.js';

function makeSource(overrides: Partial<ActiveSource> = {}): ActiveSource {
  return {
    id: 'src-1',
    organization_id: 'org-1',
    source_kind: 'test_connector',
    credential_id: null,
    config: {},
    health_score: 100,
    last_sync_at: null,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<PollSourceDeps> = {}): PollSourceDeps {
  return {
    fetchActiveSources: vi.fn().mockResolvedValue([]),
    getCredentials: vi.fn().mockResolvedValue({}),
    writeDlq: vi.fn().mockResolvedValue(undefined),
    updateSourceHealth: vi.fn().mockResolvedValue(undefined),
    ingestLeads: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function makeConnector(overrides: Partial<SourceConnector> = {}): SourceConnector {
  return {
    kind: 'test_connector',
    displayName: 'Test',
    vendorDocsUrl: 'https://example.com',
    sourceChannel: 'paid_social',
    authKind: 'api_key',
    credentialFields: [],
    testConnection: async () => ({ ok: true }),
    pollLeads: async () => [],
    normalizePayload: () => { throw new Error('not implemented'); },
    ...overrides,
  };
}

describe('pollSource', () => {
  beforeEach(() => {
    _resetRegistry();
    resetBreakers();
  });

  it('calls ingestLeads with returned leads on success', async () => {
    const leads = [{ sourceExternalId: 'ext-1' }] as never;
    registerConnector(makeConnector({ pollLeads: async () => leads }));
    const deps = makeDeps();

    await pollSource(makeSource(), deps);

    expect(deps.ingestLeads).toHaveBeenCalledWith('src-1', 'org-1', leads);
    expect(deps.writeDlq).not.toHaveBeenCalled();
  });

  it('updates health_score to success (+10) on clean poll', async () => {
    registerConnector(makeConnector());
    const deps = makeDeps();

    await pollSource(makeSource({ health_score: 90 }), deps);

    expect(deps.updateSourceHealth).toHaveBeenCalledWith(
      'src-1', 100, 'active', 'success',
    );
  });

  it('writes DLQ and decrements health on vendor error (5xx)', async () => {
    const error = Object.assign(new Error('Bad Gateway'), { status: 502 });
    registerConnector(makeConnector({ pollLeads: async () => { throw error; } }));
    const deps = makeDeps();

    await pollSource(makeSource({ health_score: 100 }), deps);

    expect(deps.writeDlq).toHaveBeenCalledWith(expect.objectContaining({
      failure_stage: 'fetch',
      error_code: '502',
    }));
    expect(deps.updateSourceHealth).toHaveBeenCalledWith(
      'src-1', 85, 'active', 'failed', 'Bad Gateway',
    );
  });

  it('sets state=revoked on auth failure (401)', async () => {
    const error = Object.assign(new Error('Unauthorized'), { status: 401 });
    registerConnector(makeConnector({ pollLeads: async () => { throw error; } }));
    const deps = makeDeps();

    await pollSource(makeSource({ health_score: 100 }), deps);

    expect(deps.updateSourceHealth).toHaveBeenCalledWith(
      'src-1', 50, 'revoked', 'failed', 'Unauthorized',
    );
  });

  it('skips polling when circuit breaker is open', async () => {
    registerConnector(makeConnector());
    const deps = makeDeps();

    // Open the breaker manually
    const { recordFailure } = await import('../../src/modules/connectors/_kernel/circuit-breaker.js');
    for (let i = 0; i < 5; i++) recordFailure('src-1');

    await pollSource(makeSource(), deps);

    expect(deps.ingestLeads).not.toHaveBeenCalled();
    expect(deps.writeDlq).not.toHaveBeenCalled();
  });

  it('writes DLQ on ingest failure but does not set health to failed', async () => {
    registerConnector(makeConnector({ pollLeads: async () => [{ sourceExternalId: 'x' }] as never }));
    const ingestError = new Error('DB constraint');
    const deps = makeDeps({ ingestLeads: vi.fn().mockRejectedValue(ingestError) });

    await pollSource(makeSource(), deps);

    expect(deps.writeDlq).toHaveBeenCalledWith(expect.objectContaining({
      failure_stage: 'ingest',
    }));
    // Health still updated to success (poll itself succeeded)
    expect(deps.updateSourceHealth).toHaveBeenCalledWith(
      'src-1', 100, 'active', 'success',
    );
  });
});
