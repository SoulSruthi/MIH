/**
 * Per-source circuit breaker: opens after 5 consecutive 5xx in a 1-minute window.
 * State is held in-process (sufficient for single-instance Inngest workers).
 * For multi-instance deployments wire to Upstash KV (V1+).
 */

type CircuitState = 'closed' | 'open';

type SourceBreaker = {
  failures: number[];  // epoch ms timestamps of recent 5xx failures
  state: CircuitState;
  openedAt?: number;
};

const FAILURE_THRESHOLD = 5;
const WINDOW_MS = 60_000;
const RESET_AFTER_MS = 60_000;

const breakers = new Map<string, SourceBreaker>();

function get(sourceId: string): SourceBreaker {
  if (!breakers.has(sourceId)) breakers.set(sourceId, { failures: [], state: 'closed' });
  return breakers.get(sourceId)!;
}

/** Returns true if the circuit is open (requests should be blocked). */
export function isOpen(sourceId: string): boolean {
  const b = get(sourceId);
  if (b.state === 'open') {
    // Auto-reset after RESET_AFTER_MS
    if (b.openedAt && Date.now() - b.openedAt > RESET_AFTER_MS) {
      b.state = 'closed';
      b.failures = [];
      b.openedAt = undefined;
      return false;
    }
    return true;
  }
  return false;
}

/** Record a 5xx failure. Opens circuit if threshold exceeded within window. */
export function recordFailure(sourceId: string): void {
  const b = get(sourceId);
  const now = Date.now();
  b.failures = b.failures.filter(ts => now - ts < WINDOW_MS);
  b.failures.push(now);
  if (b.failures.length >= FAILURE_THRESHOLD) {
    b.state = 'open';
    b.openedAt = now;
  }
}

/** Record a success — resets failure window (does NOT close an already-open circuit). */
export function recordSuccess(sourceId: string): void {
  const b = get(sourceId);
  b.failures = [];
}

/** Force-reset a breaker (used after manual reconnect). */
export function reset(sourceId: string): void {
  breakers.delete(sourceId);
}

/** For testing only. */
export function _resetAll(): void {
  breakers.clear();
}
