/**
 * Tests for Referral commission calculation — Spec 09
 * Pure function tests: no DB calls.
 */
import { describe, it, expect } from 'vitest';
import {
  computeReferralCommission,
  REFERRAL_COMMISSION_RATE,
} from '../../src/modules/referrals/commission.js';

// ---------------------------------------------------------------------------
// Eligibility: attribution gating
// ---------------------------------------------------------------------------

describe('computeReferralCommission: attribution gating', () => {
  it('not eligible when source_type is not referral', () => {
    const result = computeReferralCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'online',
      referralEventId: 'ref-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('attribution_not_referral');
    expect(result.commissionPaise).toBe(0);
  });

  it('not eligible when source_type is cp', () => {
    const result = computeReferralCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'cp',
      referralEventId: 'ref-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('attribution_not_referral');
  });
});

// ---------------------------------------------------------------------------
// Eligibility: referral event gating
// ---------------------------------------------------------------------------

describe('computeReferralCommission: referral event gating', () => {
  it('not eligible when referralEventId is null', () => {
    const result = computeReferralCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'referral',
      referralEventId: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_referral_event');
  });
});

// ---------------------------------------------------------------------------
// Eligibility: deal value gating
// ---------------------------------------------------------------------------

describe('computeReferralCommission: deal value gating', () => {
  it('not eligible when deal_value_paise is 0', () => {
    const result = computeReferralCommission({
      dealValuePaise: 0,
      winningSourceType: 'referral',
      referralEventId: 'ref-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('deal_value_zero');
  });
});

// ---------------------------------------------------------------------------
// Commission calculation
// ---------------------------------------------------------------------------

describe('computeReferralCommission: commission calculation', () => {
  it('eligible when all conditions met', () => {
    const result = computeReferralCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'referral',
      referralEventId: 'ref-001',
    });
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('commissioned');
  });

  it('commission is 1.5% of deal_value_paise', () => {
    const dealValue = 10_000_000;
    const result = computeReferralCommission({
      dealValuePaise: dealValue,
      winningSourceType: 'referral',
      referralEventId: 'ref-001',
    });
    expect(result.commissionPaise).toBe(Math.floor(dealValue * REFERRAL_COMMISSION_RATE));
    expect(result.commissionPaise).toBe(150_000);
  });

  it('commission rate is always REFERRAL_COMMISSION_RATE (1.5%)', () => {
    const result = computeReferralCommission({
      dealValuePaise: 5_000_000,
      winningSourceType: 'referral',
      referralEventId: 'ref-002',
    });
    expect(result.commissionRate).toBe(REFERRAL_COMMISSION_RATE);
    expect(result.commissionRate).toBe(0.015);
  });

  it('commission is floored (no fractional paise)', () => {
    const result = computeReferralCommission({
      dealValuePaise: 2,
      winningSourceType: 'referral',
      referralEventId: 'ref-001',
    });
    // 2 * 0.015 = 0.03 → floor → 0
    expect(result.commissionPaise).toBe(0);
    expect(result.eligible).toBe(true);
  });

  it('CP commission (2.5%) is higher than referral (1.5%) for same deal', () => {
    const dealValue = 10_000_000;
    const referralResult = computeReferralCommission({
      dealValuePaise: dealValue,
      winningSourceType: 'referral',
      referralEventId: 'ref-001',
    });
    expect(referralResult.commissionPaise).toBe(150_000);
    // sanity: 2.5% would be 250_000
    expect(referralResult.commissionPaise).toBeLessThan(250_000);
  });
});
