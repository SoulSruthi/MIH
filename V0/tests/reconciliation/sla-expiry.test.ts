/**
 * Tests for SLA expiry logic (sla-expiry.ts)
 *
 * Strategy: mock the inngest client so createFunction captures the handler,
 * then invoke the handler directly with our in-memory Supabase stub.
 *
 * Two paths tested:
 *  - Auto-expire: open item + >7 days past SLA deadline → state='expired'
 *  - Escalate: past deadline but <7 days → severity escalates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// In-memory Supabase stub
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;
type TableStore = Map<string, MockRow[]>;

function createSupabaseStub(stores: TableStore = new Map()) {
  const getStore = (table: string): MockRow[] => {
    if (!stores.has(table)) stores.set(table, []);
    return stores.get(table)!;
  };

  const buildChain = (table: string) => {
    let _filters: Array<{ field: string; op: string; value: unknown }> = [];
    let _insertData: MockRow | MockRow[] | null = null;
    let _singleMode = false;
    let _updateData: MockRow | null = null;

    const self = {
      select: (_fields = '*', _opts?: unknown) => self,
      insert: (data: MockRow | MockRow[]) => { _insertData = data; return self; },
      upsert: (data: MockRow | MockRow[], _opts?: unknown) => { _insertData = data; return self; },
      update: (data: MockRow) => { _updateData = data; return self; },
      delete: () => self,
      eq: (field: string, value: unknown) => { _filters.push({ field, op: 'eq', value }); return self; },
      not: (_f: string, _op: string, _v: unknown) => self,
      is: (_f: string, _v: unknown) => self,
      in: (_f: string, _v: unknown) => self,
      gte: (_f: string, _v: unknown) => self,
      lte: (_f: string, _v: unknown) => self,
      gt: (_f: string, _v: unknown) => self,
      lt: (_f: string, _v: unknown) => self,
      limit: (_n: number) => self,
      order: () => self,
      maybeSingle: () => { _singleMode = true; return self; },
      single: () => { _singleMode = true; return self; },
      then: (resolve: (v: { data: unknown; error: null | { message: string }; count?: number }) => void) => {
        const store = getStore(table);

        if (_insertData !== null) {
          const rows = Array.isArray(_insertData) ? _insertData : [_insertData];
          const inserted: MockRow[] = [];
          for (const row of rows) {
            const newRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ...row };
            store.push(newRow);
            inserted.push(newRow);
          }
          const result = _singleMode ? inserted[0] ?? null : inserted;
          return resolve({ data: result, error: null });
        }

        if (_updateData !== null) {
          let rows = [...store];
          for (const { field, value } of _filters) {
            rows = rows.filter(r => r[field] === value);
          }
          rows.forEach(r => Object.assign(r, _updateData));
          const result = _singleMode ? rows[0] ?? null : rows;
          return resolve({ data: result, error: null });
        }

        // SELECT
        let rows = [...store];
        for (const { field, value } of _filters) {
          rows = rows.filter(r => r[field] === value);
        }
        const result = _singleMode ? rows[0] ?? null : rows;
        return resolve({ data: result, error: null });
      },
    };
    return self;
  };

  const schemaProxy = { from: (table: string) => buildChain(table) };
  return { schema: (_name: string) => schemaProxy, stores, from: (table: string) => buildChain(table) };
}

// ---------------------------------------------------------------------------
// Captured handler from mocked inngest
// ---------------------------------------------------------------------------
let _capturedHandler: ((args: { logger: unknown }) => Promise<unknown>) | null = null;
let _stubInstance: ReturnType<typeof createSupabaseStub>;

vi.mock('../../src/inngest/client.js', () => ({
  inngest: {
    createFunction: (_config: unknown, handler: (args: { logger: unknown }) => Promise<unknown>) => {
      _capturedHandler = handler;
      return { _isMocked: true };
    },
  },
}));

vi.mock('../../src/lib/supabase-admin.js', () => ({
  getSupabaseAdmin: () => _stubInstance,
}));

// Import AFTER mocks are registered
await import('../../src/inngest/functions/sla-expiry.js');

// ---------------------------------------------------------------------------
// Helper: run the captured handler
// ---------------------------------------------------------------------------
async function runSlaExpiry(): Promise<{ escalated: number; expired: number }> {
  if (!_capturedHandler) throw new Error('Handler was not captured from inngest.createFunction');
  const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn() };
  return _capturedHandler({ logger }) as Promise<{ escalated: number; expired: number }>;
}

// ---------------------------------------------------------------------------
// Helper: ISO date string N days ago from now
// ---------------------------------------------------------------------------
function daysAgo(n: number): string {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000).toISOString();
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SLA Expiry Logic', () => {
  beforeEach(() => {
    _stubInstance = createSupabaseStub();
  });

  // -------------------------------------------------------------------------
  // Item past SLA deadline: severity escalates low→normal
  // -------------------------------------------------------------------------
  it('escalates severity from low to normal for recently breached item', async () => {
    const itemId = 'item-esc-low';
    _stubInstance.stores.set('reconciliation_items', [{
      id: itemId,
      org_id: 'org-sla',
      state: 'open',
      severity: 'low',
      sla_deadline_at: daysAgo(1), // 1 day past deadline (not 7+ days)
    }]);

    const result = await runSlaExpiry();

    expect(result.escalated).toBe(1);
    expect(result.expired).toBe(0);

    const items = _stubInstance.stores.get('reconciliation_items') ?? [];
    expect(items[0]!.severity).toBe('normal');
  });

  // -------------------------------------------------------------------------
  // Item past SLA deadline: severity escalates normal→high
  // -------------------------------------------------------------------------
  it('escalates severity from normal to high', async () => {
    _stubInstance.stores.set('reconciliation_items', [{
      id: 'item-esc-normal',
      org_id: 'org-sla',
      state: 'open',
      severity: 'normal',
      sla_deadline_at: daysAgo(2),
    }]);

    const result = await runSlaExpiry();

    expect(result.escalated).toBe(1);
    const items = _stubInstance.stores.get('reconciliation_items') ?? [];
    expect(items[0]!.severity).toBe('high');
  });

  // -------------------------------------------------------------------------
  // Item past SLA deadline: severity escalates high→critical
  // -------------------------------------------------------------------------
  it('escalates severity from high to critical', async () => {
    _stubInstance.stores.set('reconciliation_items', [{
      id: 'item-esc-high',
      org_id: 'org-sla',
      state: 'open',
      severity: 'high',
      sla_deadline_at: daysAgo(3),
    }]);

    const result = await runSlaExpiry();

    expect(result.escalated).toBe(1);
    const items = _stubInstance.stores.get('reconciliation_items') ?? [];
    expect(items[0]!.severity).toBe('critical');
  });

  // -------------------------------------------------------------------------
  // Item 7+ days past SLA with state='open': auto-expires
  // -------------------------------------------------------------------------
  it('auto-expires open item that is 7+ days past SLA deadline', async () => {
    const itemId = 'item-expire';
    _stubInstance.stores.set('reconciliation_items', [{
      id: itemId,
      org_id: 'org-sla',
      state: 'open',
      severity: 'high',
      sla_deadline_at: daysAgo(8), // 8 days past deadline
    }]);

    const result = await runSlaExpiry();

    expect(result.expired).toBe(1);
    expect(result.escalated).toBe(0);

    const items = _stubInstance.stores.get('reconciliation_items') ?? [];
    expect(items[0]!.state).toBe('expired');

    // Should write audit entry
    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('state_change');
    const newVal = audit[0]!.new_value as Record<string, unknown>;
    expect(newVal.state).toBe('expired');
  });

  // -------------------------------------------------------------------------
  // Item with severity 'critical': no further escalation (stays critical)
  // -------------------------------------------------------------------------
  it('does not escalate severity when already critical', async () => {
    _stubInstance.stores.set('reconciliation_items', [{
      id: 'item-critical',
      org_id: 'org-sla',
      state: 'open',
      severity: 'critical',
      sla_deadline_at: daysAgo(2), // past deadline, <7 days
    }]);

    const result = await runSlaExpiry();

    // No escalation since critical→critical is a no-op in the map
    expect(result.escalated).toBe(0);
    expect(result.expired).toBe(0);
  });

  // -------------------------------------------------------------------------
  // Fresh item (no items past deadline): nothing touched
  // -------------------------------------------------------------------------
  it('does not modify anything when no items are past their SLA deadline', async () => {
    // The stub does not filter on lt() — so we simulate no-breach by empty store
    _stubInstance.stores.set('reconciliation_items', []);

    const result = await runSlaExpiry();

    expect(result.escalated).toBe(0);
    expect(result.expired).toBe(0);
    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    expect(audit).toHaveLength(0);
  });

  // -------------------------------------------------------------------------
  // Writes audit entry on severity escalation
  // -------------------------------------------------------------------------
  it('writes a reconciliation_audit entry when severity is escalated', async () => {
    _stubInstance.stores.set('reconciliation_items', [{
      id: 'item-audit-esc',
      org_id: 'org-sla',
      state: 'open',
      severity: 'low',
      sla_deadline_at: daysAgo(1),
    }]);

    await runSlaExpiry();

    const audit = _stubInstance.stores.get('reconciliation_audit') ?? [];
    expect(audit).toHaveLength(1);
    expect(audit[0]!.action).toBe('state_change');
    expect(audit[0]!.actor_id).toBe('system');
    const oldVal = audit[0]!.old_value as Record<string, unknown>;
    const newVal = audit[0]!.new_value as Record<string, unknown>;
    expect(oldVal.severity).toBe('low');
    expect(newVal.severity).toBe('normal');
  });
});
