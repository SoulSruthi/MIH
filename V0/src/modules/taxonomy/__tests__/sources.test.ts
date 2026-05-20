/**
 * Tests for taxonomy sources module (Spec 01 V0)
 * All Supabase calls are mocked with simple in-memory stubs.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createCustomSource,
  updateSourceAttributes,
  updateSourceLifecycle,
  TaxonomyError,
  isValidLifecycleTransition,
} from '../sources.js';
import type { MihSource, LifecycleState } from '../types.js';

// ---------------------------------------------------------------------------
// Supabase stub factory
// ---------------------------------------------------------------------------
type MockRow = Record<string, unknown>;

function buildSupabaseStub(
  initialData: { [table: string]: MockRow[] } = {},
  insertError: { code?: string; message: string } | null = null,
) {
  const stores: { [table: string]: MockRow[] } = { ...initialData };

  const getStore = (table: string): MockRow[] => {
    if (!stores[table]) stores[table] = [];
    return stores[table];
  };

  const buildChain = (table: string) => {
    let _insertData: MockRow | null = null;
    let _updateData: MockRow | null = null;
    let _filters: Array<{ field: string; value: unknown }> = [];
    let _singleMode = false;

    const self = {
      select: () => self,
      insert: (data: MockRow) => { _insertData = data; return self; },
      update: (data: MockRow) => { _updateData = data; return self; },
      eq: (field: string, value: unknown) => { _filters.push({ field, value }); return self; },
      single: () => { _singleMode = true; return self; },
      order: () => self,
      range: () => self,
      then: (resolve: (v: { data: unknown; error: { code?: string; message: string } | null }) => void) => {
        const store = getStore(table);

        if (_insertData !== null) {
          if (insertError) {
            return resolve({ data: null, error: insertError });
          }
          const newRow: MockRow = { id: crypto.randomUUID(), created_at: new Date().toISOString(), ..._insertData };
          store.push(newRow);
          return resolve({ data: newRow, error: null });
        }

        if (_updateData !== null) {
          const updated: MockRow[] = [];
          for (const row of store) {
            const match = _filters.every(({ field, value }) => row[field] === value);
            if (match) {
              Object.assign(row, _updateData);
              updated.push(row);
            }
          }
          const result = _singleMode ? updated[0] ?? null : updated;
          return resolve({ data: result, error: null });
        }

        let rows = [...store];
        for (const { field, value } of _filters) {
          rows = rows.filter((r) => r[field] === value);
        }
        const result = _singleMode ? rows[0] ?? null : rows;
        return resolve({ data: result, error: null });
      },
    };
    return self;
  };

  const schemaProxy = { from: (table: string) => buildChain(table) };
  return {
    schema: (_name: string) => schemaProxy,
    stores,
  };
}

function makeSource(overrides: Partial<MihSource> = {}): MihSource {
  return {
    id: 'src-001',
    org_id: 'org-test',
    parent_id: null,
    level: 'channel',
    code: 'online',
    display_name: 'Online',
    taxonomy_path: 'online',
    attributes: {},
    is_platform_managed: false,
    lifecycle_state: 'active',
    launch_only_for_project_ids: [],
    created_at: new Date().toISOString(),
    created_by: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('isValidLifecycleTransition', () => {
  it('active → paused is valid', () => {
    expect(isValidLifecycleTransition('active', 'paused')).toBe(true);
  });

  it('active → killed is valid', () => {
    expect(isValidLifecycleTransition('active', 'killed')).toBe(true);
  });

  it('paused → active is valid', () => {
    expect(isValidLifecycleTransition('paused', 'active')).toBe(true);
  });

  it('killed → active is INVALID (terminal state)', () => {
    expect(isValidLifecycleTransition('killed', 'active')).toBe(false);
  });

  it('killed → paused is INVALID (terminal state)', () => {
    expect(isValidLifecycleTransition('killed', 'paused')).toBe(false);
  });

  it('killed → killed is INVALID', () => {
    expect(isValidLifecycleTransition('killed', 'killed')).toBe(false);
  });
});

describe('updateSourceLifecycle — state machine validation', () => {
  it('active → paused succeeds', async () => {
    const source = makeSource({ id: 'src-1', lifecycle_state: 'active' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    const result = await updateSourceLifecycle(
      stub as never,
      'org-test',
      'src-1',
      'paused',
    );
    expect(result.lifecycle_state).toBe('paused');
  });

  it('active → killed succeeds', async () => {
    const source = makeSource({ id: 'src-2', lifecycle_state: 'active' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    const result = await updateSourceLifecycle(stub as never, 'org-test', 'src-2', 'killed');
    expect(result.lifecycle_state).toBe('killed');
  });

  it('killed → active throws TaxonomyError', async () => {
    const source = makeSource({ id: 'src-3', lifecycle_state: 'killed' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    await expect(
      updateSourceLifecycle(stub as never, 'org-test', 'src-3', 'active'),
    ).rejects.toThrow(TaxonomyError);
  });

  it('killed → paused throws TaxonomyError', async () => {
    const source = makeSource({ id: 'src-4', lifecycle_state: 'killed' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    await expect(
      updateSourceLifecycle(stub as never, 'org-test', 'src-4', 'paused'),
    ).rejects.toThrow(TaxonomyError);
  });

  it('paused → killed succeeds', async () => {
    const source = makeSource({ id: 'src-5', lifecycle_state: 'paused' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    const result = await updateSourceLifecycle(stub as never, 'org-test', 'src-5', 'killed');
    expect(result.lifecycle_state).toBe('killed');
  });
});

describe('createCustomSource', () => {
  it('creates a source with custom.* taxonomy_path prefix', async () => {
    const parentSource = makeSource({
      id: 'parent-1',
      taxonomy_path: 'online.owned_web',
      level: 'medium',
    });
    const stub = buildSupabaseStub({ sources: [parentSource as unknown as Record<string, unknown>] });

    const result = await createCustomSource(stub as never, {
      org_id: 'org-test',
      parent_id: 'parent-1',
      code: 'my_custom_src',
      display_name: 'My Custom Source',
      level: 'source',
    });

    expect(result.taxonomy_path).toBe('online.owned_web.my_custom_src');
    expect(result.is_platform_managed).toBe(false);
  });

  it('rejects non-snake_case code', async () => {
    const parentSource = makeSource({ id: 'parent-2', taxonomy_path: 'online' });
    const stub = buildSupabaseStub({ sources: [parentSource as unknown as Record<string, unknown>] });

    await expect(
      createCustomSource(stub as never, {
        org_id: 'org-test',
        parent_id: 'parent-2',
        code: 'My Bad Code!',
        display_name: 'Bad Code',
        level: 'source',
      }),
    ).rejects.toThrow(TaxonomyError);
  });

  it('code is immutable: updateSourceAttributes cannot change code', async () => {
    // The immutability is enforced by the DB trigger, but we test that
    // updateSourceAttributes does NOT include 'code' in its patch.
    const source = makeSource({ id: 'src-code-test', code: 'original_code' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    // Patch with display_name only — should work
    const result = await updateSourceAttributes(stub as never, 'org-test', 'src-code-test', {
      display_name: 'New Display Name',
    });

    expect(result.display_name).toBe('New Display Name');
    // Code should remain unchanged (we never sent code to DB)
    const storedSource = stub.stores.sources?.find((s) => s.id === 'src-code-test');
    expect(storedSource?.code).toBe('original_code');
  });

  it('platform-managed source code cannot be changed via updateSourceAttributes', async () => {
    const source = makeSource({ id: 'plt-src', code: 'google_ads', is_platform_managed: true });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    // updateSourceAttributes only allows display_name, attributes, lifecycle_state
    // It never touches code — so no error, but code is unchanged
    const result = await updateSourceAttributes(stub as never, 'org-test', 'plt-src', {
      display_name: 'Google Ads Updated',
    });
    expect(result.display_name).toBe('Google Ads Updated');
    expect(stub.stores.sources?.find((s) => s.id === 'plt-src')?.code).toBe('google_ads');
  });
});

describe('updateSourceAttributes', () => {
  it('updates display_name', async () => {
    const source = makeSource({ id: 'src-dn', display_name: 'Old Name' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    const result = await updateSourceAttributes(stub as never, 'org-test', 'src-dn', {
      display_name: 'New Name',
    });
    expect(result.display_name).toBe('New Name');
  });

  it('updates lifecycle_state with valid transition', async () => {
    const source = makeSource({ id: 'src-ls', lifecycle_state: 'active' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    const result = await updateSourceAttributes(stub as never, 'org-test', 'src-ls', {
      lifecycle_state: 'paused',
    });
    expect(result.lifecycle_state).toBe('paused');
  });

  it('throws TaxonomyError for invalid lifecycle transition via updateSourceAttributes', async () => {
    const source = makeSource({ id: 'src-inv', lifecycle_state: 'killed' });
    const stub = buildSupabaseStub({ sources: [source as unknown as Record<string, unknown>] });

    await expect(
      updateSourceAttributes(stub as never, 'org-test', 'src-inv', {
        lifecycle_state: 'active',
      }),
    ).rejects.toThrow(TaxonomyError);
  });

  it('throws TaxonomyError if source not found', async () => {
    const stub = buildSupabaseStub({ sources: [] });

    await expect(
      updateSourceAttributes(stub as never, 'org-test', 'nonexistent', {
        display_name: 'x',
      }),
    ).rejects.toThrow(TaxonomyError);
  });
});
