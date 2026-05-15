import { describe, it, expect } from 'vitest';
import { buildCrmPayload } from '../../src/modules/crm-handoff/builder';

const baseUniqueLead = {
  crm_external_id: 'mih_testco_abc123',
  primary_phone_e164: '+919876543210',
  primary_email: null as string | null,
  primary_name: 'Ravi Kumar',
  first_seen_at: '2026-05-01T10:00:00.000Z',
  primary_source_id: 'source-1',
  touch_sources: [],
  preference_bhk: null as string | null,
  preference_budget_band: null as string | null,
  preference_location: null as string | null,
  mih_intent_score: null as number | null,
  mih_quality_grade: null as string | null,
};

const baseSource = { source_type: 'meta_lead_ads', name: 'Meta Lead Ads' };

describe('buildCrmPayload', () => {
  it('includes required fields', () => {
    const payload = buildCrmPayload(baseUniqueLead, baseSource, 'crm-org-1', null);
    expect(payload.organization_id).toBe('crm-org-1');
    expect(payload.external_id).toBe('mih_testco_abc123');
    expect(payload.name).toBe('Ravi Kumar');
    expect(payload.phone_e164).toBe('+919876543210');
    expect(payload.source).toBe('meta_lead_ads');
    expect(payload.source_channel).toBe('paid_social');
    expect(payload.source_received_at).toBe('2026-05-01T10:00:00.000Z');
  });

  it('maps source_type to correct channel', () => {
    const channels = [
      ['meta_lead_ads', 'paid_social'],
      ['google_ads', 'paid_search'],
      ['99acres', 'aggregator'],
      ['walk_in', 'walk_in'],
      ['channel_partner', 'cp'],
    ] as [string, string][];

    for (const [type, expected] of channels) {
      const p = buildCrmPayload(baseUniqueLead, { source_type: type, name: type }, 'org', null);
      expect(p.source_channel).toBe(expected);
    }
  });

  it('includes email when present', () => {
    const lead = { ...baseUniqueLead, primary_email: 'ravi@example.com' };
    const payload = buildCrmPayload(lead, baseSource, 'org', null);
    expect(payload.email).toBe('ravi@example.com');
  });

  it('omits preference when no preference fields set', () => {
    const payload = buildCrmPayload(baseUniqueLead, baseSource, 'org', null);
    expect(payload.preference).toBeUndefined();
  });

  it('includes preference when bhk is set', () => {
    const lead = { ...baseUniqueLead, preference_bhk: '3', preference_budget_band: '1-1.5Cr', preference_location: 'Whitefield' };
    const payload = buildCrmPayload(lead, baseSource, 'org', null);
    expect(payload.preference).toEqual({ bhk: 3, budget_band: '1-1.5Cr', locality: 'Whitefield' });
  });

  it('includes campaign fields from rawLead when provided', () => {
    const rawLead = {
      source_campaign_id: 'camp-1',
      source_campaign_name: 'Summer Campaign',
      source_ad_id: 'ad-1',
      source_ad_name: 'Ad 1',
      payload: { form_id: 'f1' },
    };
    const payload = buildCrmPayload(baseUniqueLead, baseSource, 'org', rawLead);
    expect(payload.source_campaign_id).toBe('camp-1');
    expect(payload.source_campaign_name).toBe('Summer Campaign');
    expect(payload.source_ad_id).toBe('ad-1');
  });
});
