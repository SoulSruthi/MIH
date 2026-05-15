import { describe, it, expect } from 'vitest';
import { normalizeMetaLead } from '../../../src/modules/connectors/meta-lead-ads/normalizer.js';
import { PhoneNormalizationError } from '../../../src/modules/connectors/_kernel/normalizer.js';
import type { MetaLeadPayload } from '../../../src/modules/connectors/meta-lead-ads/types.js';

function makePayload(fields: Record<string, string>, overrides: Partial<MetaLeadPayload> = {}): MetaLeadPayload {
  return {
    id: 'leadgen-123',
    form_id: 'form-1',
    created_time: '2026-05-14T10:00:00+0000',
    field_data: Object.entries(fields).map(([name, value]) => ({ name, values: [value] })),
    ...overrides,
  };
}

describe('normalizeMetaLead', () => {
  it('maps full_name + phone_number + email', () => {
    const result = normalizeMetaLead(makePayload({
      full_name: 'Ravi Kumar',
      phone_number: '9876543210',
      email: 'Ravi@Example.COM',
    }));
    expect(result.name).toBe('Ravi Kumar');
    expect(result.phoneE164).toBe('+919876543210');
    expect(result.email).toBe('ravi@example.com');
    expect(result.sourceExternalId).toBe('leadgen-123');
  });

  it('concatenates first_name + last_name when full_name absent', () => {
    const result = normalizeMetaLead(makePayload({
      first_name: 'Priya',
      last_name: 'Sharma',
      phone_number: '9876543210',
    }));
    expect(result.name).toBe('Priya Sharma');
  });

  it('normalizes +91 prefix phone', () => {
    const result = normalizeMetaLead(makePayload({
      full_name: 'Test User',
      phone_number: '+919876543210',
    }));
    expect(result.phoneE164).toBe('+919876543210');
  });

  it('normalizes phone with leading 0', () => {
    const result = normalizeMetaLead(makePayload({
      full_name: 'Test User',
      phone_number: '09876543210',
    }));
    expect(result.phoneE164).toBe('+919876543210');
  });

  it('maps campaign and ad attribution fields', () => {
    const result = normalizeMetaLead(makePayload(
      { full_name: 'Test', phone_number: '9876543210' },
      { campaign_id: 'camp-1', campaign_name: 'Summer Sale', ad_id: 'ad-1', ad_name: 'Creative A' },
    ));
    expect(result.sourceCampaignId).toBe('camp-1');
    expect(result.sourceCampaignName).toBe('Summer Sale');
    expect(result.sourceAdId).toBe('ad-1');
    expect(result.sourceAdName).toBe('Creative A');
  });

  it('parses created_time into Date', () => {
    const result = normalizeMetaLead(makePayload({ full_name: 'Test', phone_number: '9876543210' }));
    expect(result.sourceReceivedAt).toBeInstanceOf(Date);
    expect(result.sourceReceivedAt.getFullYear()).toBe(2026);
  });

  it('stores raw payload', () => {
    const payload = makePayload({ full_name: 'Test', phone_number: '9876543210' });
    const result = normalizeMetaLead(payload);
    expect(result.rawPayload).toBe(payload);
  });

  it('throws PhoneNormalizationError when phone field is missing', () => {
    expect(() => normalizeMetaLead(makePayload({ full_name: 'No Phone' }))).toThrow(PhoneNormalizationError);
  });

  it('email is undefined when not present', () => {
    const result = normalizeMetaLead(makePayload({ full_name: 'Test', phone_number: '9876543210' }));
    expect(result.email).toBeUndefined();
  });

  it('accepts phone field alias "mobile"', () => {
    const result = normalizeMetaLead(makePayload({ full_name: 'Test', mobile: '9876543210' }));
    expect(result.phoneE164).toBe('+919876543210');
  });

  it('uses "Unknown" as name fallback when no name fields present', () => {
    const result = normalizeMetaLead(makePayload({ phone_number: '9876543210' }));
    expect(result.name).toBe('Unknown');
  });
});
