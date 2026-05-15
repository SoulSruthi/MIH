import { describe, it, expect } from 'vitest';
import { generateCrmExternalId, parseCrmExternalId } from '../../src/modules/leads/external-id';

describe('generateCrmExternalId', () => {
  it('produces mih_{6-char-slug}_{32-char-uuid} format', () => {
    const id = generateCrmExternalId('testco', '550e8400-e29b-41d4-a716-446655440000');
    expect(id).toMatch(/^mih_[a-z0-9]{6}_[0-9a-f]{32}$/);
  });

  it('is stable — same inputs always produce the same id', () => {
    const rawLeadId = '550e8400-e29b-41d4-a716-446655440000';
    const a = generateCrmExternalId('builtrix', rawLeadId);
    const b = generateCrmExternalId('builtrix', rawLeadId);
    expect(a).toBe(b);
  });

  it('strips hyphens from UUID', () => {
    const id = generateCrmExternalId('org', '550e8400-e29b-41d4-a716-446655440000');
    expect(id).not.toContain('-');
  });

  it('uses first 6 chars of slug (lowercase)', () => {
    const id = generateCrmExternalId('MyOrg123', '550e8400-e29b-41d4-a716-446655440000');
    expect(id).toMatch(/^mih_myorg1_/);
  });

  it('pads short slug with zeros', () => {
    const id = generateCrmExternalId('ab', '550e8400-e29b-41d4-a716-446655440000');
    expect(id).toMatch(/^mih_ab0000_/);
  });

  it('different raw_lead_ids produce different external_ids', () => {
    const a = generateCrmExternalId('myorg', '550e8400-e29b-41d4-a716-446655440000');
    const b = generateCrmExternalId('myorg', '660e8400-e29b-41d4-a716-446655440000');
    expect(a).not.toBe(b);
  });
});

describe('parseCrmExternalId', () => {
  it('round-trips an id from generateCrmExternalId', () => {
    const rawLeadId = '550e8400-e29b-41d4-a716-446655440000';
    const externalId = generateCrmExternalId('myorg1', rawLeadId);
    const parsed = parseCrmExternalId(externalId);
    expect(parsed).not.toBeNull();
    expect(parsed!.rawLeadId).toBe(rawLeadId);
    expect(parsed!.orgSlug).toBe('myorg1');
  });

  it('returns null for invalid format', () => {
    expect(parseCrmExternalId('invalid')).toBeNull();
    expect(parseCrmExternalId('mih_abc_notauuid')).toBeNull();
  });
});
