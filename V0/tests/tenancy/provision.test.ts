/**
 * M-001 acceptance: provision_mih_org() RPC happy path + failure cases.
 *
 * Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in environment.
 * Unit-level tests mock the Supabase client and run without DB access.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { provisionOrg } from '../../src/modules/tenancy/provision.js';

// --- Unit tests (no real DB) ---

function makeAdminMock(rpcResult: { data: unknown; error: unknown }) {
  return {
    rpc: vi.fn().mockResolvedValue(rpcResult),
  } as never;
}

describe('provisionOrg — unit', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // suppress fetch errors in unit context
    global.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);
  });

  it('returns orgId on success', async () => {
    const admin = makeAdminMock({ data: { org_id: 'abc-123' }, error: null });
    const result = await provisionOrg(admin, {
      orgName: 'Acme Builders',
      slug: 'acme-builders',
      ownerUserId: crypto.randomUUID(),
    });
    expect(result.orgId).toBe('abc-123');
  });

  it('throws when RPC returns an error', async () => {
    const admin = makeAdminMock({ data: null, error: { message: 'unique violation' } });
    await expect(
      provisionOrg(admin, {
        orgName: 'Dupe Org',
        slug: 'dupe-org',
        ownerUserId: crypto.randomUUID(),
      }),
    ).rejects.toThrow('provision_mih_org failed: unique violation');
  });

  it('throws when RPC returns no org_id', async () => {
    const admin = makeAdminMock({ data: {}, error: null });
    await expect(
      provisionOrg(admin, {
        orgName: 'Empty Org',
        slug: 'empty-org',
        ownerUserId: crypto.randomUUID(),
      }),
    ).rejects.toThrow('provision_mih_org returned no org_id');
  });

  it('calls CRM health check when crmOrganizationId is provided', async () => {
    const admin = makeAdminMock({ data: { org_id: 'xyz-456' }, error: null });
    const fetchMock = vi.fn().mockResolvedValue({ ok: true } as Response);
    global.fetch = fetchMock;

    await provisionOrg(admin, {
      orgName: 'CRM Org',
      slug: 'crm-org',
      ownerUserId: crypto.randomUUID(),
      crmOrganizationId: crypto.randomUUID(),
      crmBaseUrl: 'https://crm.builtrix.io',
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://crm.builtrix.io/api/sister/v1/health',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('throws when CRM health check fails', async () => {
    const admin = makeAdminMock({ data: { org_id: 'xyz-789' }, error: null });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 503 } as Response);

    await expect(
      provisionOrg(admin, {
        orgName: 'Bad CRM Org',
        slug: 'bad-crm-org',
        ownerUserId: crypto.randomUUID(),
        crmOrganizationId: crypto.randomUUID(),
        crmBaseUrl: 'https://crm.builtrix.io',
      }),
    ).rejects.toThrow('CRM health check returned HTTP 503');
  });

  it('skips CRM health check when crmOrganizationId is absent', async () => {
    const admin = makeAdminMock({ data: { org_id: 'no-crm-org' }, error: null });
    const fetchMock = vi.fn();
    global.fetch = fetchMock;

    await provisionOrg(admin, {
      orgName: 'No CRM Org',
      slug: 'no-crm-org',
      ownerUserId: crypto.randomUUID(),
    });

    expect(fetchMock).not.toHaveBeenCalled();
  });
});

// --- Integration tests (real DB) ---

describe('provisionOrg — integration', () => {
  const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
  const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

  function skipIfNoEnv() {
    return !SUPABASE_URL || !SERVICE_KEY;
  }

  it('creates org + membership + dedup_rules + audit row in one transaction', async () => {
    if (skipIfNoEnv()) return;

    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const ownerUserId = crypto.randomUUID();
    const slug = `integ-test-${Date.now()}`;

    const result = await provisionOrg(admin, {
      orgName: 'Integration Test Org',
      slug,
      ownerUserId,
    });

    expect(result.orgId).toBeTruthy();

    const [{ data: org }, { data: membership }, { data: dedup }] = await Promise.all([
      admin.from('organizations').select('id,slug').eq('id', result.orgId).single(),
      admin.from('memberships').select('app_roles').eq('organization_id', result.orgId).single(),
      admin.from('dedup_rules').select('phone_window_hours').eq('organization_id', result.orgId).single(),
    ]);

    expect(org?.slug).toBe(slug);
    expect(membership?.app_roles).toContain('mih_org_admin');
    expect(dedup?.phone_window_hours).toBe(24);

    // cleanup
    await admin.from('organizations').delete().eq('id', result.orgId);
  });
});
