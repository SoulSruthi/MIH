/**
 * Tests for Channel Partner commission calculation — Spec 08
 * Pure function tests: no DB calls.
 */
import { describe, it, expect } from 'vitest';
import {
  computeCpCommission,
  CP_COMMISSION_RATE,
} from '../../src/modules/channel-partners/commission.js';

// ---------------------------------------------------------------------------
// Eligibility: attribution gating
// ---------------------------------------------------------------------------

describe('computeCpCommission: attribution gating', () => {
  it('not eligible when source_type is not cp', () => {
    const result = computeCpCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'online',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('attribution_not_cp');
    expect(result.commissionPaise).toBe(0);
  });

  it('not eligible when source_type is referral', () => {
    const result = computeCpCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'referral',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('attribution_not_cp');
  });

  it('not eligible when source_type is empty string', () => {
    const result = computeCpCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: '',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('attribution_not_cp');
  });
});

// ---------------------------------------------------------------------------
// Eligibility: channel partner gating
// ---------------------------------------------------------------------------

describe('computeCpCommission: channel partner gating', () => {
  it('not eligible when channelPartnerId is null', () => {
    const result = computeCpCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'cp',
      channelPartnerId: null,
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('no_channel_partner');
  });
});

// ---------------------------------------------------------------------------
// Eligibility: deal value gating
// ---------------------------------------------------------------------------

describe('computeCpCommission: deal value gating', () => {
  it('not eligible when deal_value_paise is 0', () => {
    const result = computeCpCommission({
      dealValuePaise: 0,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('deal_value_zero');
  });

  it('not eligible when deal_value_paise is negative', () => {
    const result = computeCpCommission({
      dealValuePaise: -1000,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(false);
    expect(result.reason).toBe('deal_value_zero');
  });
});

// ---------------------------------------------------------------------------
// Commission calculation
// ---------------------------------------------------------------------------

describe('computeCpCommission: commission calculation', () => {
  it('eligible when source_type=cp, has channelPartnerId, and deal_value > 0', () => {
    const result = computeCpCommission({
      dealValuePaise: 10_000_000,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.eligible).toBe(true);
    expect(result.reason).toBe('commissioned');
  });

  it('commission is 2.5% of deal_value_paise', () => {
    const dealValue = 10_000_000;  // 1 lakh INR in paise
    const result = computeCpCommission({
      dealValuePaise: dealValue,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.commissionPaise).toBe(Math.floor(dealValue * CP_COMMISSION_RATE));
    expect(result.commissionPaise).toBe(250_000);
  });

  it('commission is floored (no fractional paise)', () => {
    // 1 paise × 2.5% = 0.025 → floors to 0
    const result = computeCpCommission({
      dealValuePaise: 1,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.commissionPaise).toBe(0);
    expect(result.eligible).toBe(true);
  });

  it('commission rate is always CP_COMMISSION_RATE', () => {
    const result = computeCpCommission({
      dealValuePaise: 5_000_000,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-002',
    });
    expect(result.commissionRate).toBe(CP_COMMISSION_RATE);
    expect(result.commissionRate).toBe(0.025);
  });

  it('large deal value: 1 crore INR (100x lakh)', () => {
    const oneCroreInPaise = 100_000_000_00;  // 1 crore INR in paise
    const result = computeCpCommission({
      dealValuePaise: oneCroreInPaise,
      winningSourceType: 'cp',
      channelPartnerId: 'cp-001',
    });
    expect(result.commissionPaise).toBe(2_500_000_00);  // 2.5 lakh INR
  });
});
