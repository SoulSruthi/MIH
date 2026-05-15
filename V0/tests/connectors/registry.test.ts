import { describe, it, expect, beforeEach } from 'vitest';
import {
  registerConnector,
  getConnector,
  listConnectors,
  hasConnector,
  _resetRegistry,
} from '../../src/modules/connectors/_kernel/registry.js';
import type { SourceConnector } from '../../src/modules/connectors/_kernel/types.js';

function makeConnector(kind: string): SourceConnector {
  return {
    kind,
    displayName: `Test ${kind}`,
    vendorDocsUrl: 'https://example.com',
    sourceChannel: 'paid_social',
    authKind: 'api_key',
    credentialFields: [],
    testConnection: async () => ({ ok: true }),
    pollLeads: async () => [],
    normalizePayload: () => { throw new Error('not implemented'); },
  };
}

describe('Connector registry', () => {
  beforeEach(() => _resetRegistry());

  it('registers and retrieves a connector by kind', () => {
    registerConnector(makeConnector('meta_lead_ads'));
    const c = getConnector('meta_lead_ads');
    expect(c.kind).toBe('meta_lead_ads');
  });

  it('lists all registered connectors', () => {
    registerConnector(makeConnector('meta_lead_ads'));
    registerConnector(makeConnector('google_ads'));
    expect(listConnectors()).toHaveLength(2);
  });

  it('throws on duplicate registration', () => {
    registerConnector(makeConnector('meta_lead_ads'));
    expect(() => registerConnector(makeConnector('meta_lead_ads'))).toThrow(
      "Connector 'meta_lead_ads' is already registered",
    );
  });

  it('throws on unknown kind', () => {
    expect(() => getConnector('unknown_kind')).toThrow("Unknown connector kind: 'unknown_kind'");
  });

  it('hasConnector returns true/false correctly', () => {
    registerConnector(makeConnector('meta_lead_ads'));
    expect(hasConnector('meta_lead_ads')).toBe(true);
    expect(hasConnector('google_ads')).toBe(false);
  });

  it('adding new connector requires zero changes outside its own module', () => {
    // The registry is generic — any kind string is valid
    registerConnector(makeConnector('sulekha'));
    expect(hasConnector('sulekha')).toBe(true);
  });
});
