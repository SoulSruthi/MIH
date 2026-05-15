import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  isOpen,
  recordFailure,
  recordSuccess,
  reset,
  _resetAll,
} from '../../src/modules/connectors/_kernel/circuit-breaker.js';

describe('Circuit breaker', () => {
  beforeEach(() => _resetAll());
  afterEach(() => vi.useRealTimers());

  const SRC = 'source-abc';

  it('is closed by default', () => {
    expect(isOpen(SRC)).toBe(false);
  });

  it('opens after 5 consecutive failures in 1-minute window', () => {
    for (let i = 0; i < 5; i++) recordFailure(SRC);
    expect(isOpen(SRC)).toBe(true);
  });

  it('does NOT open after 4 failures', () => {
    for (let i = 0; i < 4; i++) recordFailure(SRC);
    expect(isOpen(SRC)).toBe(false);
  });

  it('failure in org A source does not affect org B source', () => {
    const SRC_B = 'source-xyz';
    for (let i = 0; i < 5; i++) recordFailure(SRC);
    expect(isOpen(SRC)).toBe(true);
    expect(isOpen(SRC_B)).toBe(false);
  });

  it('recordSuccess resets failure window (prevents spurious open)', () => {
    for (let i = 0; i < 4; i++) recordFailure(SRC);
    recordSuccess(SRC);
    recordFailure(SRC); // only 1 failure after reset — should not open
    expect(isOpen(SRC)).toBe(false);
  });

  it('reset() force-clears an open circuit', () => {
    for (let i = 0; i < 5; i++) recordFailure(SRC);
    expect(isOpen(SRC)).toBe(true);
    reset(SRC);
    expect(isOpen(SRC)).toBe(false);
  });

  it('auto-resets after RESET_AFTER_MS (1 minute)', () => {
    vi.useFakeTimers();
    for (let i = 0; i < 5; i++) recordFailure(SRC);
    expect(isOpen(SRC)).toBe(true);

    // Advance 61 seconds
    vi.advanceTimersByTime(61_000);
    expect(isOpen(SRC)).toBe(false);
  });

  it('failures older than 1 minute are evicted from the window', () => {
    vi.useFakeTimers();
    // Record 4 failures
    for (let i = 0; i < 4; i++) recordFailure(SRC);
    // Advance past window
    vi.advanceTimersByTime(61_000);
    // 1 more failure — old ones expired, so counter = 1 (not 5)
    recordFailure(SRC);
    expect(isOpen(SRC)).toBe(false);
  });
});
