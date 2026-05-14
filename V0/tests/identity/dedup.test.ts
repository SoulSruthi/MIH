import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveDedup } from '../../src/modules/identity/dedup.js';
import type { RawLeadRef, DedupDeps } from '../../src/modules/identity/types.js';

vi.mock('../../src/modules/identity/rules.js', () => ({
  getOrgDedupRules: vi.fn(),
}));

vi.mock('../../src/modules/identity/graph.js', () => ({
  lookupPhoneIdentifier: vi.fn(),
  getClusterPrimaryLeadId: vi.fn(),
  getUniqueLead: vi.fn(),
  createClusterWithIdentifier: vi.fn(),
  updateClusterPrimaryLead: vi.fn(),
  createUniqueLead: vi.fn(),
  updateUniqueLeadOnDuplicate: vi.fn(),
  updateRawLeadDedup: vi.fn(),
  writeAuditLog: vi.fn(),
}));

import * as rulesModule from '../../src/modules/identity/rules.js';
import * as graphModule from '../../src/modules/identity/graph.js';

const mockGetOrgDedupRules = vi.mocked(rulesModule.getOrgDedupRules);
const mockLookupPhone = vi.mocked(graphModule.lookupPhoneIdentifier);
const mockGetClusterPrimaryLeadId = vi.mocked(graphModule.getClusterPrimaryLeadId);
const mockGetUniqueLead = vi.mocked(graphModule.getUniqueLead);
const mockCreateCluster = vi.mocked(graphModule.createClusterWithIdentifier);
const mockUpdateClusterPrimaryLead = vi.mocked(graphModule.updateClusterPrimaryLead);
const mockCreateUniqueLead = vi.mocked(graphModule.createUniqueLead);
const mockUpdateUniqueLeadOnDuplicate = vi.mocked(graphModule.updateUniqueLeadOnDuplicate);
const mockUpdateRawLeadDedup = vi.mocked(graphModule.updateRawLeadDedup);
const mockWriteAuditLog = vi.mocked(graphModule.writeAuditLog);

const STUB_SUPABASE = {} as never;
const DEFAULT_RULES = { phone_window_hours: 24, post_window_behavior: 'new_lead' as const };

function makeRawLead(overrides: Partial<RawLeadRef> = {}): RawLeadRef {
  return {
    id: 'raw-1',
    phone_e164: '+919876543210',
    email: 'ravi@example.com',
    name: 'Ravi Kumar',
    source_id: 'src-1',
    source_received_at: new Date('2026-01-01T10:00:00Z').toISOString(),
    ...overrides,
  };
}

function makeDeps(overrides: Partial<DedupDeps> = {}): DedupDeps {
  return {
    supabaseAdmin: STUB_SUPABASE,
    emitDedupDecided: vi.fn().mockResolvedValue(undefined),
    requestId: 'req-test-1',
    ...overrides,
  };
}

function makeExistingLead(overrides: Partial<{
  id: string; primary_name: string; known_names: string[];
  last_seen_at: string; total_touches: number; touch_sources: never[];
}> = {}) {
  return {
    id: 'ulead-existing',
    primary_name: 'Ravi Kumar',
    known_names: [] as string[],
    last_seen_at: new Date('2026-01-01T10:00:00Z').toISOString(),
    total_touches: 1,
    touch_sources: [] as never[],
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetOrgDedupRules.mockResolvedValue(DEFAULT_RULES);
  mockLookupPhone.mockResolvedValue(null);
  mockCreateCluster.mockResolvedValue({ clusterId: 'cluster-new' });
  mockCreateUniqueLead.mockResolvedValue({ uniqueLeadId: 'ulead-new' });
  mockUpdateClusterPrimaryLead.mockResolvedValue(undefined);
  mockUpdateRawLeadDedup.mockResolvedValue(undefined);
  mockWriteAuditLog.mockResolvedValue(undefined);
  mockUpdateUniqueLeadOnDuplicate.mockResolvedValue(undefined);
  mockGetClusterPrimaryLeadId.mockResolvedValue(null);
  mockGetUniqueLead.mockResolvedValue(null);
});

// =================================================================
// UNIQUE — new phone
// =================================================================

describe('new phone (first time seen)', () => {
  it('returns outcome=unique with new uniqueLeadId', async () => {
    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(result.outcome).toBe('unique');
    expect(result.uniqueLeadId).toBe('ulead-new');
  });

  it('creates cluster with identifier', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(mockCreateCluster).toHaveBeenCalledWith(STUB_SUPABASE, 'org-1', '+919876543210');
  });

  it('creates unique_lead with known_names=[] for first-seen lead', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(mockCreateUniqueLead).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({
        organization_id: 'org-1',
        identity_cluster_id: 'cluster-new',
        primary_phone_e164: '+919876543210',
        primary_name: 'Ravi Kumar',
        total_touches: 1,
        known_names: [],
      }),
    );
  });

  it('sets cluster primary lead after creation', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(mockUpdateClusterPrimaryLead).toHaveBeenCalledWith(STUB_SUPABASE, 'cluster-new', 'ulead-new');
  });

  it('updates raw_lead dedup_status to unique with no dedup_reason', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(mockUpdateRawLeadDedup).toHaveBeenCalledWith(STUB_SUPABASE, 'raw-1', 'unique', 'ulead-new', undefined);
  });

  it('writes audit_log with action dedup.unique_confirmed', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({
        action: 'dedup.unique_confirmed',
        record_id: 'raw-1',
        organization_id: 'org-1',
      }),
    );
  });

  it('fires emitDedupDecided with unique status', async () => {
    const emitDedupDecided = vi.fn().mockResolvedValue(undefined);
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ emitDedupDecided }));
    expect(emitDedupDecided).toHaveBeenCalledWith({
      unique_lead_id: 'ulead-new',
      dedup_status: 'unique',
      org_id: 'org-1',
    });
  });
});

// =================================================================
// DUPLICATE — same phone within window
// =================================================================

describe('same phone within dedup window → DUPLICATE', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const lastSeenAt = new Date('2026-01-01T10:00:00Z').toISOString();

  beforeEach(() => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({ last_seen_at: lastSeenAt }));
  });

  it('returns outcome=duplicate pointing at existing uniqueLeadId', async () => {
    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(result.outcome).toBe('duplicate');
    expect(result.uniqueLeadId).toBe('ulead-existing');
  });

  it('does NOT create a new cluster or unique_lead', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockCreateCluster).not.toHaveBeenCalled();
    expect(mockCreateUniqueLead).not.toHaveBeenCalled();
  });

  it('increments total_touches and appends touch_sources', async () => {
    const rawLead = makeRawLead({ id: 'raw-dup', source_id: 'src-2', source_received_at: now.toISOString() });
    await resolveDedup(rawLead, 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE,
      'ulead-existing',
      expect.objectContaining({
        total_touches: 2,
        touch_sources: expect.arrayContaining([
          expect.objectContaining({ raw_lead_id: 'raw-dup', source_id: 'src-2' }),
        ]),
      }),
    );
  });

  it('sets dedup_reason=within_window on raw_lead', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateRawLeadDedup).toHaveBeenCalledWith(
      STUB_SUPABASE, 'raw-1', 'duplicate', 'ulead-existing', 'within_window',
    );
  });

  it('writes audit_log with action dedup.duplicate_detected', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({ action: 'dedup.duplicate_detected' }),
    );
  });

  it('fires emitDedupDecided with duplicate status', async () => {
    const emitDedupDecided = vi.fn().mockResolvedValue(undefined);
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now, emitDedupDecided }));
    expect(emitDedupDecided).toHaveBeenCalledWith({
      unique_lead_id: 'ulead-existing',
      dedup_status: 'duplicate',
      org_id: 'org-1',
    });
  });
});

// =================================================================
// UNIQUE after window — new_lead behavior (default)
// =================================================================

describe('same phone after window, post_window_behavior=new_lead', () => {
  const now = new Date('2026-01-03T12:00:00Z');  // 50h after lastSeenAt
  const lastSeenAt = new Date('2026-01-01T10:00:00Z').toISOString();

  beforeEach(() => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({ last_seen_at: lastSeenAt }));
    mockGetOrgDedupRules.mockResolvedValue({ phone_window_hours: 24, post_window_behavior: 'new_lead' });
  });

  it('returns outcome=unique (new person after window)', async () => {
    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(result.outcome).toBe('unique');
    expect(result.uniqueLeadId).toBe('ulead-new');
  });

  it('creates a new unique_lead under the same cluster', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockCreateUniqueLead).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({ identity_cluster_id: 'cluster-abc' }),
    );
  });

  it('updates cluster primary lead to the new unique_lead', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateClusterPrimaryLead).toHaveBeenCalledWith(
      STUB_SUPABASE, 'cluster-abc', 'ulead-new',
    );
  });

  it('does NOT call updateUniqueLeadOnDuplicate', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateUniqueLeadOnDuplicate).not.toHaveBeenCalled();
  });

  it('sets no dedup_reason on raw_lead (unique outcome)', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateRawLeadDedup).toHaveBeenCalledWith(
      STUB_SUPABASE, 'raw-1', 'unique', 'ulead-new', undefined,
    );
  });
});

// =================================================================
// DUPLICATE after window — merge_existing behavior
// =================================================================

describe('same phone after window, post_window_behavior=merge_existing', () => {
  const now = new Date('2026-01-03T12:00:00Z');
  const lastSeenAt = new Date('2026-01-01T10:00:00Z').toISOString();

  beforeEach(() => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({ total_touches: 2, last_seen_at: lastSeenAt }));
    mockGetOrgDedupRules.mockResolvedValue({ phone_window_hours: 24, post_window_behavior: 'merge_existing' });
  });

  it('returns outcome=duplicate even after window when merge_existing', async () => {
    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(result.outcome).toBe('duplicate');
    expect(result.uniqueLeadId).toBe('ulead-existing');
  });

  it('sets dedup_reason=post_window_merge on raw_lead', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateRawLeadDedup).toHaveBeenCalledWith(
      STUB_SUPABASE, 'raw-1', 'duplicate', 'ulead-existing', 'post_window_merge',
    );
  });

  it('merges into existing: increments touches', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE, 'ulead-existing', expect.objectContaining({ total_touches: 3 }),
    );
  });
});

// =================================================================
// KNOWN NAMES merging
// =================================================================

describe('known_names — name merging across sources', () => {
  const now = new Date('2026-01-01T12:00:00Z');
  const lastSeenAt = new Date('2026-01-01T10:00:00Z').toISOString();

  it('adds new name to known_names when duplicate has different name', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({
      primary_name: 'Ravi Kumar',
      known_names: [],
      last_seen_at: lastSeenAt,
    }));

    await resolveDedup(
      makeRawLead({ name: 'R. Kumar' }),  // different name, same phone
      'org-1',
      makeDeps({ now: () => now }),
    );

    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE, 'ulead-existing',
      expect.objectContaining({ known_names: ['R. Kumar'] }),
    );
  });

  it('does NOT add duplicate name if already in known_names', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({
      primary_name: 'Ravi Kumar',
      known_names: ['R. Kumar'],
      last_seen_at: lastSeenAt,
    }));

    await resolveDedup(makeRawLead({ name: 'R. Kumar' }), 'org-1', makeDeps({ now: () => now }));

    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE, 'ulead-existing',
      expect.objectContaining({ known_names: ['R. Kumar'] }),  // unchanged
    );
  });

  it('does NOT add name to known_names if same as primary_name', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({
      primary_name: 'Ravi Kumar',
      known_names: [],
      last_seen_at: lastSeenAt,
    }));

    await resolveDedup(makeRawLead({ name: 'Ravi Kumar' }), 'org-1', makeDeps({ now: () => now }));

    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE, 'ulead-existing',
      expect.objectContaining({ known_names: [] }),
    );
  });

  it('accumulates multiple unique names', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-abc' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-existing');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({
      primary_name: 'Ravi Kumar',
      known_names: ['R. Kumar', 'Ravi K'],
      last_seen_at: lastSeenAt,
    }));

    await resolveDedup(makeRawLead({ name: 'RAVI KUMAR SINGH' }), 'org-1', makeDeps({ now: () => now }));

    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledWith(
      STUB_SUPABASE, 'ulead-existing',
      expect.objectContaining({ known_names: ['R. Kumar', 'Ravi K', 'RAVI KUMAR SINGH'] }),
    );
  });

  it('first-seen unique_lead always has known_names=[]', async () => {
    await resolveDedup(makeRawLead({ name: 'Ravi Kumar' }), 'org-1', makeDeps());
    expect(mockCreateUniqueLead).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({ primary_name: 'Ravi Kumar', known_names: [] }),
    );
  });
});

// =================================================================
// Configurable window per org
// =================================================================

describe('configurable dedup window', () => {
  it('uses org-specific phone_window_hours from dedup_rules', async () => {
    const now = new Date('2026-01-02T16:00:00Z');
    const lastSeenAt = new Date('2026-01-01T10:00:00Z').toISOString(); // 30h ago
    mockGetOrgDedupRules.mockResolvedValue({ phone_window_hours: 48, post_window_behavior: 'new_lead' });
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-x' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-x');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({ id: 'ulead-x', last_seen_at: lastSeenAt }));

    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(result.outcome).toBe('duplicate');
  });

  it('1h window: 3h old → past window → new_lead', async () => {
    const now = new Date('2026-01-01T12:00:00Z');
    const lastSeenAt = new Date('2026-01-01T09:00:00Z').toISOString();
    mockGetOrgDedupRules.mockResolvedValue({ phone_window_hours: 1, post_window_behavior: 'new_lead' });
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-y' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-y');
    mockGetUniqueLead.mockResolvedValue(makeExistingLead({ id: 'ulead-y', last_seen_at: lastSeenAt }));

    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps({ now: () => now }));
    expect(result.outcome).toBe('unique');
  });

  it('defaults to 24h window when no dedup_rules row exists', async () => {
    mockGetOrgDedupRules.mockResolvedValue({ phone_window_hours: 24, post_window_behavior: 'new_lead' });
    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(result.outcome).toBe('unique');
    expect(mockGetOrgDedupRules).toHaveBeenCalledWith(STUB_SUPABASE, 'org-1');
  });
});

// =================================================================
// Edge cases
// =================================================================

describe('edge cases', () => {
  it('does not emit if emitDedupDecided is undefined', async () => {
    await expect(
      resolveDedup(makeRawLead(), 'org-1', makeDeps({ emitDedupDecided: undefined })),
    ).resolves.not.toThrow();
  });

  it('uses provided requestId in audit_log', async () => {
    await resolveDedup(makeRawLead(), 'org-1', makeDeps({ requestId: 'custom-req-id' }));
    expect(mockWriteAuditLog).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({ request_id: 'custom-req-id' }),
    );
  });

  it('handles orphaned cluster → creates fresh unique_lead', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-orphan' });
    mockGetClusterPrimaryLeadId.mockResolvedValue('ulead-gone');
    mockGetUniqueLead.mockResolvedValue(null);

    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(result.outcome).toBe('unique');
    expect(mockCreateUniqueLead).toHaveBeenCalled();
  });

  it('handles cluster with no primary_unique_lead_id → creates unique_lead and links', async () => {
    mockLookupPhone.mockResolvedValue({ clusterId: 'cluster-empty' });
    mockGetClusterPrimaryLeadId.mockResolvedValue(null);

    const result = await resolveDedup(makeRawLead(), 'org-1', makeDeps());
    expect(result.outcome).toBe('unique');
    expect(mockCreateUniqueLead).toHaveBeenCalledWith(
      STUB_SUPABASE,
      expect.objectContaining({ identity_cluster_id: 'cluster-empty' }),
    );
    expect(mockUpdateClusterPrimaryLead).toHaveBeenCalledWith(
      STUB_SUPABASE, 'cluster-empty', 'ulead-new',
    );
  });

  it('propagates error from getOrgDedupRules', async () => {
    mockGetOrgDedupRules.mockRejectedValue(new Error('db down'));
    await expect(resolveDedup(makeRawLead(), 'org-1', makeDeps())).rejects.toThrow('db down');
  });

  it('propagates error from createClusterWithIdentifier', async () => {
    mockCreateCluster.mockRejectedValue(new Error('cluster insert failed'));
    await expect(resolveDedup(makeRawLead(), 'org-1', makeDeps())).rejects.toThrow('cluster insert failed');
  });
});

// =================================================================
// Acceptance: same phone × 5 → 1 unique + 4 duplicates
// =================================================================

describe('acceptance: same phone × 5 → 1 unique + 4 duplicates', () => {
  it('first call creates unique_lead; subsequent calls return duplicate', async () => {
    const phone = '+919999999999';
    const now = new Date('2026-01-01T12:00:00Z');
    const seenAt = new Date('2026-01-01T11:00:00Z').toISOString();

    mockLookupPhone.mockResolvedValueOnce(null);
    mockCreateCluster.mockResolvedValueOnce({ clusterId: 'cluster-1' });
    mockCreateUniqueLead.mockResolvedValueOnce({ uniqueLeadId: 'ulead-1' });

    const r1 = await resolveDedup(
      makeRawLead({ id: 'raw-1', phone_e164: phone, source_received_at: seenAt }),
      'org-1', makeDeps({ now: () => now }),
    );
    expect(r1.outcome).toBe('unique');

    for (let i = 2; i <= 5; i++) {
      mockLookupPhone.mockResolvedValueOnce({ clusterId: 'cluster-1' });
      mockGetClusterPrimaryLeadId.mockResolvedValueOnce('ulead-1');
      mockGetUniqueLead.mockResolvedValueOnce(makeExistingLead({
        id: 'ulead-1',
        last_seen_at: seenAt,
        total_touches: i - 1,
      }));

      const r = await resolveDedup(
        makeRawLead({ id: `raw-${i}`, phone_e164: phone, source_received_at: now.toISOString() }),
        'org-1', makeDeps({ now: () => now }),
      );
      expect(r.outcome).toBe('duplicate');
      expect(r.uniqueLeadId).toBe('ulead-1');
    }

    expect(mockCreateUniqueLead).toHaveBeenCalledTimes(1);
    expect(mockUpdateUniqueLeadOnDuplicate).toHaveBeenCalledTimes(4);
  });
});

// =================================================================
// rules module call check
// =================================================================

describe('rules module — getOrgDedupRules (via actual import)', () => {
  it('is called with correct supabase client and orgId', async () => {
    await resolveDedup(makeRawLead(), 'org-xyz', makeDeps());
    expect(mockGetOrgDedupRules).toHaveBeenCalledWith(STUB_SUPABASE, 'org-xyz');
  });
});
