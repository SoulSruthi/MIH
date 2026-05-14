import { describe, it, expect, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isPrivateIp } from '../../src/modules/crm-handoff/dns-guard';

// Integration tests for circuit breaker use mocked Supabase
// These verify the state machine logic

describe('circuit breaker state machine (unit)', () => {
  it('isPrivateIp correctly identifies ranges (precondition for SSRF guard)', () => {
    expect(isPrivateIp('10.0.0.1')).toBe(true);
    expect(isPrivateIp('8.8.8.8')).toBe(false);
  });
});

describe('recordFailure threshold logic', () => {
  it('opens circuit after FAILURE_THRESHOLD consecutive failures', async () => {
    // Build a mock Supabase that simulates DB calls
    let storedState = {
      id: 'test',
      consecutive_failures: 4,  // one away from threshold
      opened_at: null as string | null,
      state: 'closed',
    };

    const supabase = {
      from: (_table: string) => ({
        select: (_cols: string) => ({
          eq: (_col: string, _val: string) => ({
            maybeSingle: async () => ({ data: storedState }),
          }),
        }),
        update: (updates: Record<string, unknown>) => ({
          eq: (_col: string, _val: string) => {
            Object.assign(storedState, updates);
            return { data: storedState, error: null };
          },
        }),
        insert: (row: Record<string, unknown>) => {
          Object.assign(storedState, row);
          return { data: storedState, error: null };
        },
      }),
    } as unknown as SupabaseClient;

    const { recordFailure } = await import('../../src/modules/crm-handoff/circuit-breaker');
    const result = await recordFailure(supabase, 'org-1', 'https://crm.builtrix.io');

    expect(result.opened).toBe(true);
    expect(storedState.state).toBe('open');
  });
});

describe('circuit breaker constants', () => {
  it('exports CircuitOpenError', async () => {
    const { CircuitOpenError } = await import('../../src/modules/crm-handoff/circuit-breaker');
    const err = new CircuitOpenError('test-org');
    expect(err.name).toBe('CircuitOpenError');
    expect(err.orgId).toBe('test-org');
    expect(err.message).toContain('test-org');
  });
});
