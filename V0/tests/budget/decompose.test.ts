/**
 * Tests for Budget decomposition — Spec 07
 * Pure function tests: no DB calls.
 */
import { describe, it, expect } from 'vitest';
import {
  decomposeBudget,
  fyStartDate,
  fyEndDate,
} from '../../src/modules/budget/decompose.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sumPlanned(periods: { planned_paise: number }[]): number {
  return periods.reduce((s, p) => s + p.planned_paise, 0);
}

// ---------------------------------------------------------------------------
// Basic structure
// ---------------------------------------------------------------------------

describe('decomposeBudget: structure', () => {
  it('returns annual, quarterly, monthly, weekly keys', () => {
    const result = decomposeBudget(2026, 1_000_000_00);
    expect(result).toHaveProperty('annual');
    expect(result).toHaveProperty('quarterly');
    expect(result).toHaveProperty('monthly');
    expect(result).toHaveProperty('weekly');
  });

  it('annual has exactly 1 record', () => {
    const result = decomposeBudget(2026, 1_000_000_00);
    expect(result.annual).toHaveLength(1);
  });

  it('quarterly has exactly 4 records', () => {
    const result = decomposeBudget(2026, 1_000_000_00);
    expect(result.quarterly).toHaveLength(4);
  });

  it('monthly has exactly 12 records', () => {
    const result = decomposeBudget(2026, 1_000_000_00);
    expect(result.monthly).toHaveLength(12);
  });

  it('weekly has exactly 52 records', () => {
    const result = decomposeBudget(2026, 1_000_000_00);
    expect(result.weekly).toHaveLength(52);
  });
});

// ---------------------------------------------------------------------------
// Period type labels
// ---------------------------------------------------------------------------

describe('decomposeBudget: period types', () => {
  it('all annual periods have period_type=annual', () => {
    const { annual } = decomposeBudget(2026, 1_000_000_00);
    expect(annual.every((p) => p.period_type === 'annual')).toBe(true);
  });

  it('all quarterly periods have period_type=quarterly', () => {
    const { quarterly } = decomposeBudget(2026, 1_000_000_00);
    expect(quarterly.every((p) => p.period_type === 'quarterly')).toBe(true);
  });

  it('all monthly periods have period_type=monthly', () => {
    const { monthly } = decomposeBudget(2026, 1_000_000_00);
    expect(monthly.every((p) => p.period_type === 'monthly')).toBe(true);
  });

  it('all weekly periods have period_type=weekly', () => {
    const { weekly } = decomposeBudget(2026, 1_000_000_00);
    expect(weekly.every((p) => p.period_type === 'weekly')).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Sum invariant: each tier sums to total_paise
// ---------------------------------------------------------------------------

describe('decomposeBudget: sum invariant', () => {
  const TOTAL = 1_000_000_00;

  it('quarterly sum equals total_paise', () => {
    const { quarterly } = decomposeBudget(2026, TOTAL);
    expect(sumPlanned(quarterly)).toBe(TOTAL);
  });

  it('monthly sum equals total_paise', () => {
    const { monthly } = decomposeBudget(2026, TOTAL);
    expect(sumPlanned(monthly)).toBe(TOTAL);
  });

  it('weekly sum equals total_paise', () => {
    const { weekly } = decomposeBudget(2026, TOTAL);
    expect(sumPlanned(weekly)).toBe(TOTAL);
  });

  it('annual planned_paise equals total_paise', () => {
    const { annual } = decomposeBudget(2026, TOTAL);
    expect(annual[0]!.planned_paise).toBe(TOTAL);
  });
});

// ---------------------------------------------------------------------------
// Zero budget edge case
// ---------------------------------------------------------------------------

describe('decomposeBudget: zero budget', () => {
  it('all period amounts are 0 when total is 0', () => {
    const result = decomposeBudget(2026, 0);
    expect(sumPlanned(result.quarterly)).toBe(0);
    expect(sumPlanned(result.monthly)).toBe(0);
    expect(sumPlanned(result.weekly)).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// FY date boundaries
// ---------------------------------------------------------------------------

describe('decomposeBudget: FY date boundaries', () => {
  it('FY2026 annual start_date is 2026-04-01', () => {
    const { annual } = decomposeBudget(2026, 1_000_00);
    expect(annual[0]!.start_date).toBe('2026-04-01');
  });

  it('FY2026 annual end_date is 2027-03-31', () => {
    const { annual } = decomposeBudget(2026, 1_000_00);
    expect(annual[0]!.end_date).toBe('2027-03-31');
  });

  it('Q1 FY2026 starts on 2026-04-01', () => {
    const { quarterly } = decomposeBudget(2026, 1_000_00);
    expect(quarterly[0]!.start_date).toBe('2026-04-01');
  });

  it('Q4 FY2026 ends on 2027-03-31', () => {
    const { quarterly } = decomposeBudget(2026, 1_000_00);
    expect(quarterly[3]!.end_date).toBe('2027-03-31');
  });

  it('monthly order starts with April', () => {
    const { monthly } = decomposeBudget(2026, 1_000_00);
    expect(monthly[0]!.start_date).toBe('2026-04-01');
  });

  it('monthly order ends with March', () => {
    const { monthly } = decomposeBudget(2026, 1_000_00);
    expect(monthly[11]!.start_date).toBe('2027-03-01');
  });
});

// ---------------------------------------------------------------------------
// Proportionality: larger months get more budget
// ---------------------------------------------------------------------------

describe('decomposeBudget: proportionality', () => {
  it('January (31 days) gets more than February (28/29 days)', () => {
    const { monthly } = decomposeBudget(2026, 1_000_000_00);
    // Jan 2027 is monthly[9], Feb 2027 is monthly[10]
    const jan = monthly.find((m) => m.period_label === 'Jan 2027');
    const feb = monthly.find((m) => m.period_label === 'Feb 2027');
    expect(jan).toBeDefined();
    expect(feb).toBeDefined();
    expect(jan!.planned_paise).toBeGreaterThan(feb!.planned_paise);
  });
});

// ---------------------------------------------------------------------------
// Labels
// ---------------------------------------------------------------------------

describe('decomposeBudget: labels', () => {
  it('annual label is Annual FY2026', () => {
    const { annual } = decomposeBudget(2026, 1_000_00);
    expect(annual[0]!.period_label).toBe('Annual FY2026');
  });

  it('quarterly labels include Q1 through Q4', () => {
    const { quarterly } = decomposeBudget(2026, 1_000_00);
    const labels = quarterly.map((q) => q.period_label);
    expect(labels).toContain('Q1 FY2026');
    expect(labels).toContain('Q2 FY2026');
    expect(labels).toContain('Q3 FY2026');
    expect(labels).toContain('Q4 FY2026');
  });

  it('weekly labels start at Week 01', () => {
    const { weekly } = decomposeBudget(2026, 1_000_00);
    expect(weekly[0]!.period_label).toBe('Week 01 FY2026');
  });
});
