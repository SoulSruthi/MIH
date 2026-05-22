/**
 * Tests for Referrer re-engagement dormancy check — Spec 09
 * Pure function tests: no DB calls.
 */
import { describe, it, expect } from 'vitest';
import {
  checkReferrerDormancy,
  filterDormantReferrers,
  DORMANCY_DAYS,
} from '../../src/modules/referrals/reengagement.js';

const NOW = '2026-05-21T12:00:00Z';

function daysAgo(n: number, from = NOW): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// checkReferrerDormancy: never referred
// ---------------------------------------------------------------------------

describe('checkReferrerDormancy: never referred', () => {
  it('isDormant=true when lastReferralAt is null', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: null,
      nowAt: NOW,
    });
    expect(result.isDormant).toBe(true);
    expect(result.daysSinceLastReferral).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// checkReferrerDormancy: boundary cases
// ---------------------------------------------------------------------------

describe('checkReferrerDormancy: boundary', () => {
  it('isDormant=false when last referral was 89 days ago', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: daysAgo(89),
      nowAt: NOW,
    });
    expect(result.isDormant).toBe(false);
    expect(result.daysSinceLastReferral).toBe(89);
  });

  it('isDormant=true when last referral was exactly 90 days ago', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: daysAgo(90),
      nowAt: NOW,
    });
    expect(result.isDormant).toBe(true);
    expect(result.daysSinceLastReferral).toBe(90);
  });

  it('isDormant=true when last referral was 120 days ago', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: daysAgo(120),
      nowAt: NOW,
    });
    expect(result.isDormant).toBe(true);
    expect(result.daysSinceLastReferral).toBe(120);
  });

  it('isDormant=false when last referral was today', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: daysAgo(0),
      nowAt: NOW,
    });
    expect(result.isDormant).toBe(false);
    expect(result.daysSinceLastReferral).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// checkReferrerDormancy: threshold constant
// ---------------------------------------------------------------------------

describe('checkReferrerDormancy: threshold', () => {
  it('dormancyThresholdDays is always 90', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-001',
      lastReferralAt: null,
      nowAt: NOW,
    });
    expect(result.dormancyThresholdDays).toBe(DORMANCY_DAYS);
    expect(result.dormancyThresholdDays).toBe(90);
  });

  it('referrerId is preserved in result', () => {
    const result = checkReferrerDormancy({
      referrerId: 'r-xyz-123',
      lastReferralAt: null,
      nowAt: NOW,
    });
    expect(result.referrerId).toBe('r-xyz-123');
  });
});

// ---------------------------------------------------------------------------
// filterDormantReferrers
// ---------------------------------------------------------------------------

describe('filterDormantReferrers', () => {
  it('returns only dormant referrers', () => {
    const referrers = [
      { referrerId: 'r-active', lastReferralAt: daysAgo(10), nowAt: NOW },
      { referrerId: 'r-dormant-1', lastReferralAt: daysAgo(100), nowAt: NOW },
      { referrerId: 'r-dormant-2', lastReferralAt: null, nowAt: NOW },
    ];
    const dormant = filterDormantReferrers(referrers);
    expect(dormant).toHaveLength(2);
    expect(dormant.map((r) => r.referrerId)).toContain('r-dormant-1');
    expect(dormant.map((r) => r.referrerId)).toContain('r-dormant-2');
  });

  it('returns empty array when no dormant referrers', () => {
    const referrers = [
      { referrerId: 'r-1', lastReferralAt: daysAgo(5), nowAt: NOW },
      { referrerId: 'r-2', lastReferralAt: daysAgo(30), nowAt: NOW },
    ];
    expect(filterDormantReferrers(referrers)).toHaveLength(0);
  });

  it('returns all when all are dormant', () => {
    const referrers = [
      { referrerId: 'r-1', lastReferralAt: daysAgo(95), nowAt: NOW },
      { referrerId: 'r-2', lastReferralAt: null, nowAt: NOW },
    ];
    expect(filterDormantReferrers(referrers)).toHaveLength(2);
  });

  it('empty input returns empty array', () => {
    expect(filterDormantReferrers([])).toHaveLength(0);
  });
});
