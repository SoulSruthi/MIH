/**
 * Tests for project-source-autodisable logic (Spec MIH V2.2)
 *
 * Uses in-memory stubs to simulate the Supabase queries.
 * No real DB calls — pure unit tests.
 */
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Types mirroring the allowlist row shape used in the Inngest function
// ---------------------------------------------------------------------------

type AllowlistRow = {
  id: string;
  org_id: string;
  project_id: string;
  source_id: string;
  auto_disable_at: string | null; // ISO timestamp, or null
  enabled: boolean;
};

// ---------------------------------------------------------------------------
// In-memory stub implementation of the auto-disable logic
//
// This mirrors the logic in:
//   src/inngest/functions/project-source-autodisable.ts
//
// We extract it here as a testable pure(-ish) function that accepts
// an in-memory store instead of a live Supabase client.
// ---------------------------------------------------------------------------

type DisableResult = {
  id: string;
  disabled: boolean;
  error?: string;
};

type Logger = {
  info: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
};

/**
 * Core auto-disable logic, extracted from the Inngest function for testability.
 *
 * @param store  Mutable in-memory array of allowlist rows (mutated by the function)
 * @param now    Current timestamp for comparison
 * @param logger Logger stub
 * @returns      { disabled: number } count of rows successfully disabled
 */
async function runAutoDisableLogic(
  store: AllowlistRow[],
  now: Date,
  logger: Logger,
): Promise<{ disabled: number }> {
  // Step 1: Find all enabled rows with auto_disable_at < now
  const expiredRows = store.filter(
    (row) =>
      row.enabled &&
      row.auto_disable_at !== null &&
      new Date(row.auto_disable_at) < now,
  );

  if (expiredRows.length === 0) {
    logger.info('No expired project source allowlist rows to disable');
    return { disabled: 0 };
  }

  let disabled = 0;

  for (const row of expiredRows) {
    // Step 2: Disable the row in-store
    const idx = store.findIndex((r) => r.id === row.id);
    if (idx === -1) {
      logger.error('Failed to disable project source allowlist row', { id: row.id });
      continue;
    }

    store[idx] = { ...store[idx], enabled: false };

    // Step 3: Log the disabled entry
    logger.info('Disabled expired project source', {
      org_id: row.org_id,
      project_id: row.project_id,
      source_id: row.source_id,
      auto_disable_at: row.auto_disable_at,
    });

    disabled++;
  }

  return { disabled };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const NOW = new Date('2026-05-21T01:00:00Z');

function makeRow(overrides: Partial<AllowlistRow> & { id: string }): AllowlistRow {
  return {
    org_id: 'org-test',
    project_id: 'proj-test',
    source_id: 'src-test',
    auto_disable_at: null,
    enabled: true,
    ...overrides,
  };
}

function makeLogger(): Logger & { infoLogs: unknown[][]; errorLogs: unknown[][] } {
  const infoLogs: unknown[][] = [];
  const errorLogs: unknown[][] = [];
  return {
    info: (...args: unknown[]) => infoLogs.push(args),
    error: (...args: unknown[]) => errorLogs.push(args),
    infoLogs,
    errorLogs,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('runAutoDisableLogic', () => {
  // -------------------------------------------------------------------------
  // Expired entry (auto_disable_at in past) gets disabled
  // -------------------------------------------------------------------------
  describe('expired entry', () => {
    it('disables a row whose auto_disable_at is in the past', async () => {
      const store: AllowlistRow[] = [
        makeRow({
          id: 'row-expired',
          auto_disable_at: '2026-05-20T00:00:00Z', // one day before NOW
          enabled: true,
        }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(1);
      expect(store[0].enabled).toBe(false);
    });

    it('logs the disabled entry with correct fields', async () => {
      const store: AllowlistRow[] = [
        makeRow({
          id: 'row-log-check',
          org_id: 'org-abc',
          project_id: 'proj-xyz',
          source_id: 'src-tv_ads',
          auto_disable_at: '2026-04-01T00:00:00Z',
          enabled: true,
        }),
      ];

      const logger = makeLogger();
      await runAutoDisableLogic(store, NOW, logger);

      expect(logger.infoLogs).toHaveLength(1);
      const logArg = logger.infoLogs[0][1] as Record<string, unknown>;
      expect(logArg.org_id).toBe('org-abc');
      expect(logArg.project_id).toBe('proj-xyz');
      expect(logArg.source_id).toBe('src-tv_ads');
      expect(logArg.auto_disable_at).toBe('2026-04-01T00:00:00Z');
    });

    it('disables multiple expired entries in one pass', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'exp-1', auto_disable_at: '2026-05-01T00:00:00Z', enabled: true }),
        makeRow({ id: 'exp-2', auto_disable_at: '2026-05-10T00:00:00Z', enabled: true }),
        makeRow({ id: 'exp-3', auto_disable_at: '2026-05-15T00:00:00Z', enabled: true }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(3);
      expect(store.every((r) => !r.enabled)).toBe(true);
    });

    it('returns disabled count equal to number of expired rows', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'e1', auto_disable_at: '2026-01-01T00:00:00Z', enabled: true }),
        makeRow({ id: 'e2', auto_disable_at: '2026-02-01T00:00:00Z', enabled: true }),
      ];

      const result = await runAutoDisableLogic(store, NOW, makeLogger());

      expect(result.disabled).toBe(2);
    });
  });

  // -------------------------------------------------------------------------
  // Future entry is not touched
  // -------------------------------------------------------------------------
  describe('future entry', () => {
    it('does NOT disable a row whose auto_disable_at is in the future', async () => {
      const store: AllowlistRow[] = [
        makeRow({
          id: 'row-future',
          auto_disable_at: '2026-12-31T00:00:00Z', // far in the future
          enabled: true,
        }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(0);
      expect(store[0].enabled).toBe(true);
    });

    it('does not log any "disabled" message for a future row', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'row-future-2', auto_disable_at: '2027-01-01T00:00:00Z', enabled: true }),
      ];

      const logger = makeLogger();
      await runAutoDisableLogic(store, NOW, logger);

      // Only the "no expired rows" info log, no per-row disable log
      expect(logger.infoLogs[0][0]).toContain('No expired');
    });

    it('selectively disables only expired rows when mixed with future rows', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'past', auto_disable_at: '2026-04-01T00:00:00Z', enabled: true }),
        makeRow({ id: 'future', auto_disable_at: '2026-12-31T00:00:00Z', enabled: true }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(1);
      const pastRow = store.find((r) => r.id === 'past')!;
      const futureRow = store.find((r) => r.id === 'future')!;
      expect(pastRow.enabled).toBe(false);
      expect(futureRow.enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Null auto_disable_at is not touched
  // -------------------------------------------------------------------------
  describe('null auto_disable_at', () => {
    it('does NOT disable a row with null auto_disable_at', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'row-null-date', auto_disable_at: null, enabled: true }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(0);
      expect(store[0].enabled).toBe(true);
    });

    it('never logs a disable message for null auto_disable_at rows', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'row-null-1', auto_disable_at: null, enabled: true }),
        makeRow({ id: 'row-null-2', auto_disable_at: null, enabled: true }),
      ];

      const logger = makeLogger();
      await runAutoDisableLogic(store, NOW, logger);

      // Should emit "no expired rows" log but no per-row disable log
      expect(logger.infoLogs).toHaveLength(1);
      expect(logger.infoLogs[0][0]).toContain('No expired');
    });

    it('ignores null-date rows even when other rows are expired', async () => {
      const store: AllowlistRow[] = [
        makeRow({ id: 'null-date', auto_disable_at: null, enabled: true }),
        makeRow({ id: 'expired', auto_disable_at: '2026-05-01T00:00:00Z', enabled: true }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      expect(result.disabled).toBe(1);
      const nullRow = store.find((r) => r.id === 'null-date')!;
      expect(nullRow.enabled).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // Already-disabled rows are not touched again
  // -------------------------------------------------------------------------
  describe('already-disabled rows', () => {
    it('skips rows where enabled=false even if auto_disable_at is in the past', async () => {
      const store: AllowlistRow[] = [
        makeRow({
          id: 'already-off',
          auto_disable_at: '2026-04-01T00:00:00Z',
          enabled: false, // already disabled
        }),
      ];

      const logger = makeLogger();
      const result = await runAutoDisableLogic(store, NOW, logger);

      // Should not count as a newly disabled row
      expect(result.disabled).toBe(0);
    });
  });

  // -------------------------------------------------------------------------
  // Empty store → returns { disabled: 0 }
  // -------------------------------------------------------------------------
  describe('empty store', () => {
    it('returns disabled=0 for an empty allowlist', async () => {
      const logger = makeLogger();
      const result = await runAutoDisableLogic([], NOW, logger);

      expect(result.disabled).toBe(0);
    });
  });
});
