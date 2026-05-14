/** Health score delta constants per connector-framework plan. */
export const HEALTH_DELTA = {
  SUCCESS: +10,
  VENDOR_ERROR: -15,
  AUTH_FAILURE: -50,
  RATE_LIMIT: -5,
  NORMALIZE_FAILURE: -5,
} as const;

export const HEALTH_THRESHOLDS = {
  DEGRADED: 69,
  PAUSED: 30,
} as const;

export type SourceState = 'unauthorized' | 'authorized' | 'active' | 'degraded' | 'paused' | 'revoked';

/** Clamps score to [0, 100]. */
export function clampScore(score: number): number {
  return Math.max(0, Math.min(100, score));
}

/** Applies a delta and returns the new clamped score + derived state. */
export function applyHealthDelta(
  currentScore: number,
  delta: number,
): { score: number; state: SourceState } {
  const score = clampScore(currentScore + delta);
  const state = deriveState(score);
  return { score, state };
}

export function deriveState(score: number): SourceState {
  if (score > HEALTH_THRESHOLDS.DEGRADED) return 'active';
  if (score > HEALTH_THRESHOLDS.PAUSED) return 'degraded';
  return 'paused';
}

/** Returns the health update to apply after a sync event. */
export type SyncEvent =
  | { kind: 'success' }
  | { kind: 'vendor_error' }
  | { kind: 'auth_failure' }
  | { kind: 'rate_limit' }
  | { kind: 'normalize_failure'; count: number };

export function deltaForEvent(event: SyncEvent): number {
  switch (event.kind) {
    case 'success': return HEALTH_DELTA.SUCCESS;
    case 'vendor_error': return HEALTH_DELTA.VENDOR_ERROR;
    case 'auth_failure': return HEALTH_DELTA.AUTH_FAILURE;
    case 'rate_limit': return HEALTH_DELTA.RATE_LIMIT;
    case 'normalize_failure': return HEALTH_DELTA.NORMALIZE_FAILURE * event.count;
  }
}
