import { describe, it, expect } from 'vitest';
import {
  applyHealthDelta,
  deriveState,
  deltaForEvent,
  clampScore,
  HEALTH_DELTA,
} from '../../src/modules/connectors/_kernel/health.js';

describe('health score', () => {
  it('clamps to 100 on repeated success', () => {
    let score = 100;
    for (let i = 0; i < 5; i++) {
      ({ score } = applyHealthDelta(score, HEALTH_DELTA.SUCCESS));
    }
    expect(score).toBe(100);
  });

  it('reaches 100 after 10 consecutive successes from 0', () => {
    let score = 0;
    for (let i = 0; i < 10; i++) {
      ({ score } = applyHealthDelta(score, HEALTH_DELTA.SUCCESS));
    }
    expect(score).toBe(100);
  });

  it('decrements on vendor error (-15)', () => {
    const { score } = applyHealthDelta(100, HEALTH_DELTA.VENDOR_ERROR);
    expect(score).toBe(85);
  });

  it('decrements heavily on auth failure (-50)', () => {
    const { score } = applyHealthDelta(100, HEALTH_DELTA.AUTH_FAILURE);
    expect(score).toBe(50);
  });

  it('clamps to 0 on repeated failures', () => {
    let score = 100;
    for (let i = 0; i < 20; i++) {
      ({ score } = applyHealthDelta(score, HEALTH_DELTA.VENDOR_ERROR));
    }
    expect(score).toBe(0);
  });

  it('state: active when score > 69', () => {
    expect(deriveState(100)).toBe('active');
    expect(deriveState(70)).toBe('active');
  });

  it('state: degraded when score 30–69', () => {
    expect(deriveState(69)).toBe('degraded');
    expect(deriveState(50)).toBe('degraded');
    expect(deriveState(31)).toBe('degraded');
  });

  it('state: paused when score <= 30', () => {
    expect(deriveState(30)).toBe('paused');
    expect(deriveState(0)).toBe('paused');
  });

  it('deltaForEvent maps correctly', () => {
    expect(deltaForEvent({ kind: 'success' })).toBe(HEALTH_DELTA.SUCCESS);
    expect(deltaForEvent({ kind: 'vendor_error' })).toBe(HEALTH_DELTA.VENDOR_ERROR);
    expect(deltaForEvent({ kind: 'auth_failure' })).toBe(HEALTH_DELTA.AUTH_FAILURE);
    expect(deltaForEvent({ kind: 'rate_limit' })).toBe(HEALTH_DELTA.RATE_LIMIT);
    expect(deltaForEvent({ kind: 'normalize_failure', count: 3 })).toBe(HEALTH_DELTA.NORMALIZE_FAILURE * 3);
  });

  it('clampScore bounds at 0 and 100', () => {
    expect(clampScore(-999)).toBe(0);
    expect(clampScore(999)).toBe(100);
    expect(clampScore(50)).toBe(50);
  });
});
