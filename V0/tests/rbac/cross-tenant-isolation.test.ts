/**
 * M-001 acceptance: cross-tenant RLS isolation for organizations, memberships,
 * credentials, and dedup_rules tables.
 *
 * Runs against a real Supabase project or local Supabase stack.
 * Requires SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY.
 * All tests are skipped when env vars are absent (unit CI without DB).
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';

function skipIfNoEnv() {
  return !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY;
}

function admin() {
  return createClient(SUPABASE_URL, SERVICE_KEY);
}

type OrgFixture = {
  orgId: string;
  userId: string;
  client: SupabaseClient;
};

async function provisionTestOrg(suffix: string): Promise<OrgFixture> {
  const userId = crypto.randomUUID();
  const { data, error } = await admin().rpc('provision_mih_org', {
    p_org_name: `Test Org ${suffix}`,
    p_slug: `test-org-${suffix}-${Date.now()}`,
    p_owner_user_id: userId,
    p_crm_organization_id: null,
    p_crm_base_url: 'https://crm.builtrix.io',
  });
  if (error) throw new Error(`provision failed: ${error.message}`);
  const orgId = data.org_id as string;

  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: {
      headers: {
        'X-Test-Org-Id': orgId,
        'X-Test-User-Id': userId,
      },
    },
  });

  return { orgId, userId, client };
}

async function cleanupOrg(orgId: string) {
  await admin().from('organizations').delete().eq('id', orgId);
}

describe('M-001 cross-tenant RLS isolation', () => {
  let orgA: OrgFixture;
  let orgB: OrgFixture;

  beforeAll(async () => {
    if (skipIfNoEnv()) return;
    [orgA, orgB] = await Promise.all([provisionTestOrg('a'), provisionTestOrg('b')]);
  });

  afterAll(async () => {
    if (skipIfNoEnv()) return;
    await Promise.all([cleanupOrg(orgA.orgId), cleanupOrg(orgB.orgId)]);
  });

  // --- memberships ---

  it('org A cannot read org B memberships', async () => {
    if (skipIfNoEnv()) return;
    const { data } = await orgA.client
      .from('memberships')
      .select('id')
      .eq('organization_id', orgB.orgId);
    expect(data).toHaveLength(0);
  });

  it('org A cannot insert membership for org B', async () => {
    if (skipIfNoEnv()) return;
    const { error } = await orgA.client.from('memberships').insert({
      organization_id: orgB.orgId,
      user_id: crypto.randomUUID(),
      base_role: 'org_user',
      app_roles: [],
    });
    expect(error).not.toBeNull();
  });

  it('org A cannot update org B memberships', async () => {
    if (skipIfNoEnv()) return;
    const { error } = await orgA.client
      .from('memberships')
      .update({ status: 'suspended' })
      .eq('organization_id', orgB.orgId);
    expect(error).toBeNull(); // RLS blocks silently — 0 rows affected
    const { data } = await admin()
      .from('memberships')
      .select('status')
      .eq('organization_id', orgB.orgId)
      .single();
    expect(data?.status).toBe('active');
  });

  it('org A cannot delete org B memberships', async () => {
    if (skipIfNoEnv()) return;
    await orgA.client.from('memberships').delete().eq('organization_id', orgB.orgId);
    const { data } = await admin()
      .from('memberships')
      .select('id')
      .eq('organization_id', orgB.orgId);
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  // --- credentials ---

  it('org A cannot read org B credentials', async () => {
    if (skipIfNoEnv()) return;
    const { data } = await orgA.client
      .from('credentials')
      .select('id')
      .eq('organization_id', orgB.orgId);
    expect(data).toHaveLength(0);
  });

  it('org A cannot insert credentials for org B', async () => {
    if (skipIfNoEnv()) return;
    const { error } = await orgA.client.from('credentials').insert({
      organization_id: orgB.orgId,
      kind: 'api_key',
      display_label: 'test',
      ciphertext: Buffer.from('x').toString('base64'),
      nonce: Buffer.from('y').toString('base64'),
    });
    expect(error).not.toBeNull();
  });

  // --- dedup_rules ---

  it('org A cannot read org B dedup_rules', async () => {
    if (skipIfNoEnv()) return;
    const { data } = await orgA.client
      .from('dedup_rules')
      .select('id')
      .eq('organization_id', orgB.orgId);
    expect(data).toHaveLength(0);
  });

  it('org A cannot modify org B dedup_rules', async () => {
    if (skipIfNoEnv()) return;
    const { error } = await orgA.client
      .from('dedup_rules')
      .update({ phone_window_hours: 1 })
      .eq('organization_id', orgB.orgId);
    expect(error).toBeNull(); // RLS = 0 rows silently
    const { data } = await admin()
      .from('dedup_rules')
      .select('phone_window_hours')
      .eq('organization_id', orgB.orgId)
      .single();
    expect(data?.phone_window_hours).toBe(24);
  });

  // --- super admin ---

  it('service role sees all orgs', async () => {
    if (skipIfNoEnv()) return;
    const { data } = await admin()
      .from('memberships')
      .select('organization_id')
      .in('organization_id', [orgA.orgId, orgB.orgId]);
    const ids = data!.map((r) => r.organization_id);
    expect(ids).toContain(orgA.orgId);
    expect(ids).toContain(orgB.orgId);
  });

  // --- JWT with no organization_id claim ---

  it('anonymous client sees zero tenant-scoped rows', async () => {
    if (skipIfNoEnv()) return;
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anonClient.from('memberships').select('id');
    expect(data).toHaveLength(0);
  });
});
