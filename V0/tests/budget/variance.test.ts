/**
 * Tests for Budget variance computation — Spec 07
 * Pure function tests: no DB calls.
 */
import { describe, it, expect } from 'vitest';
import {
  computeVariance,
  validateReallocation,
} from '../../src/modules/budget/variance.js';
import type { VarianceInput } from '../../src/modules/budget/variance.js';

function makePeriod(overrides: Partial<VarianceInput> = {}): VarianceInput {
  return {
    period_id: 'period-001',
    period_type: 'monthly',
    period_label: 'Apr 2026',
    start_date: '2026-04-01',
    end_date: '2026-04-30',
    planned_paise: 1_000_000,
    actual_paise: 0,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// computeVariance: basic
// ---------------------------------------------------------------------------

describe('computeVariance: basic calculations', () => {
  it('variance_paise = actual - planned', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 80 })]);
    expect(result!.variance_paise).toBe(-20);
  });

  it('positive variance when over budget', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 130 })]);
    expect(result!.variance_paise).toBe(30);
    expect(result!.is_over_budget).toBe(true);
  });

  it('negative variance when underspend', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 70 })]);
    expect(result!.variance_paise).toBe(-30);
    expect(result!.is_over_budget).toBe(false);
  });

  it('zero variance when exactly on plan', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 100 })]);
    expect(result!.variance_paise).toBe(0);
    expect(result!.is_over_budget).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// computeVariance: variance_pct
// ---------------------------------------------------------------------------

describe('computeVariance: variance_pct', () => {
  it('variance_pct is null when planned = 0', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 0, actual_paise: 100 })]);
    expect(result!.variance_pct).toBeNull();
  });

  it('variance_pct is 50 when 50% over budget', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 150 })]);
    expect(result!.variance_pct).toBe(50);
  });

  it('variance_pct is -25 when 25% under budget', () => {
    const [result] = computeVariance([makePeriod({ planned_paise: 100, actual_paise: 75 })]);
    expect(result!.variance_pct).toBe(-25);
  });

  it('variance_pct is rounded to 2 decimal places', () => {
    // 1 / 3 = 33.333...% over
    const [result] = computeVariance([makePeriod({ planned_paise: 3, actual_paise: 4 })]);
    expect(result!.variance_pct).toBe(33.33);
  });
});

// ---------------------------------------------------------------------------
// computeVariance: passthrough fields
// ---------------------------------------------------------------------------

describe('computeVariance: field passthrough', () => {
  it('preserves period_id', () => {
    const [result] = computeVariance([makePeriod({ period_id: 'p-xyz' })]);
    expect(result!.period_id).toBe('p-xyz');
  });

  it('preserves period_label', () => {
    const [result] = computeVariance([makePeriod({ period_label: 'Q2 FY2026' })]);
    expect(result!.period_label).toBe('Q2 FY2026');
  });
});

// ---------------------------------------------------------------------------
// computeVariance: multiple periods
// ---------------------------------------------------------------------------

describe('computeVariance: multiple periods', () => {
  it('returns same count as input', () => {
    const periods = [
      makePeriod({ period_id: 'a' }),
      makePeriod({ period_id: 'b' }),
      makePeriod({ period_id: 'c' }),
    ];
    expect(computeVariance(periods)).toHaveLength(3);
  });

  it('empty input returns empty array', () => {
    expect(computeVariance([])).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// validateReallocation
// ---------------------------------------------------------------------------

describe('validateReallocation', () => {
  it('valid when amount <= from_period planned', () => {
    expect(validateReallocation(1000, 500).valid).toBe(true);
  });

  it('valid when amount equals from_period planned (full transfer)', () => {
    expect(validateReallocation(500, 500).valid).toBe(true);
  });

  it('invalid when amount > from_period planned', () => {
    const result = validateReallocation(500, 600);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Insufficient budget');
  });

  it('invalid when amount <= 0', () => {
    const result = validateReallocation(1000, 0);
    expect(result.valid).toBe(false);
    expect(result.error).toContain('greater than 0');
  });

  it('invalid when amount is negative', () => {
    const result = validateReallocation(1000, -100);
    expect(result.valid).toBe(false);
  });
});
