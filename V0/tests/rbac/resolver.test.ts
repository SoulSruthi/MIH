/**
 * M-002 acceptance: RBAC resolver — all 6 roles, allow/deny matrix.
 */

import { describe, it, expect } from 'vitest';
import { resolve, ForbiddenError } from '../../src/modules/rbac/service.js';
import type { TenantContext } from '../../src/modules/tenancy/context.js';

function ctx(overrides: Partial<TenantContext>): TenantContext {
  return {
    orgId: 'org-1',
    userId: 'user-1',
    baseRole: 'org_user',
    appRoles: [],
    permissions: [],
    isolation: 'pool',
    tier: 'standard',
    requestId: 'req-1',
    ...overrides,
  };
}

// --- super_admin ---
describe('super_admin', () => {
  const c = ctx({ baseRole: 'super_admin' });

  it('can view all orgs (platform)', async () => {
    expect(await resolve(c, 'organization:view:platform')).toBe(true);
  });

  it('can suspend any org', async () => {
    expect(await resolve(c, 'organization:suspend:platform')).toBe(true);
  });

  it('can invite to any org', async () => {
    expect(await resolve(c, 'user:invite:any_org')).toBe(true);
  });

  it('CANNOT view raw_leads of a specific org (no raw_lead grant on super_admin base role)', async () => {
    expect(await resolve(c, 'raw_lead:view:org')).toBe(false);
  });
});

// --- mih_org_admin ---
describe('mih_org_admin', () => {
  const c = ctx({ appRoles: ['mih_org_admin'] });

  it('can configure sources', async () => {
    expect(await resolve(c, 'source:configure:org')).toBe(true);
  });

  it('can manage users', async () => {
    expect(await resolve(c, 'user:invite:org')).toBe(true);
    expect(await resolve(c, 'user:change_role:org')).toBe(true);
    expect(await resolve(c, 'user:remove:org')).toBe(true);
  });

  it('can configure CRM connection', async () => {
    expect(await resolve(c, 'crm_connection:configure:org')).toBe(true);
  });

  it('CANNOT access platform-level operations', async () => {
    expect(await resolve(c, 'organization:suspend:platform')).toBe(false);
    expect(await resolve(c, 'user:invite:any_org')).toBe(false);
  });
});

// --- marketing_manager ---
describe('marketing_manager', () => {
  const c = ctx({ appRoles: ['marketing_manager'] });

  it('can view and customize dashboard', async () => {
    expect(await resolve(c, 'dashboard:view:org')).toBe(true);
    expect(await resolve(c, 'dashboard:customize:org')).toBe(true);
  });

  it('can view campaigns (sources)', async () => {
    expect(await resolve(c, 'source:view:org')).toBe(true);
  });

  it('CANNOT configure sources', async () => {
    expect(await resolve(c, 'source:configure:org')).toBe(false);
  });

  it('CANNOT manage users', async () => {
    expect(await resolve(c, 'user:invite:org')).toBe(false);
    expect(await resolve(c, 'user:change_role:org')).toBe(false);
  });
});

// --- marketing_analyst ---
describe('marketing_analyst', () => {
  const c = ctx({ appRoles: ['marketing_analyst'] });

  it('can view raw_leads', async () => {
    expect(await resolve(c, 'raw_lead:view:org')).toBe(true);
  });

  it('can create reports', async () => {
    expect(await resolve(c, 'report:create:org')).toBe(true);
    expect(await resolve(c, 'report:export:org')).toBe(true);
  });

  it('CANNOT configure sources or manage users', async () => {
    expect(await resolve(c, 'source:configure:org')).toBe(false);
    expect(await resolve(c, 'user:invite:org')).toBe(false);
  });
});

// --- marketing_ops ---
describe('marketing_ops', () => {
  const c = ctx({ appRoles: ['marketing_ops'] });

  it('can configure sources', async () => {
    expect(await resolve(c, 'source:configure:org')).toBe(true);
  });

  it('can replay DLQ', async () => {
    expect(await resolve(c, 'raw_lead:replay:org')).toBe(true);
  });

  it('CANNOT manage users', async () => {
    expect(await resolve(c, 'user:invite:org')).toBe(false);
  });
});

// --- org_viewer ---
describe('org_viewer', () => {
  const c = ctx({ appRoles: ['org_viewer'] });

  it('can view dashboard', async () => {
    expect(await resolve(c, 'dashboard:view:org')).toBe(true);
  });

  it('CANNOT customize dashboard', async () => {
    expect(await resolve(c, 'dashboard:customize:org')).toBe(false);
  });

  it('CANNOT view raw_leads', async () => {
    expect(await resolve(c, 'raw_lead:view:org')).toBe(false);
  });

  it('CANNOT configure anything', async () => {
    expect(await resolve(c, 'source:configure:org')).toBe(false);
    expect(await resolve(c, 'crm_connection:configure:org')).toBe(false);
    expect(await resolve(c, 'dedup_rule:configure:org')).toBe(false);
  });
});

// --- multi-role ---
describe('multi-role (marketing_analyst + marketing_ops)', () => {
  const c = ctx({ appRoles: ['marketing_analyst', 'marketing_ops'] });

  it('inherits all permissions from both roles', async () => {
    expect(await resolve(c, 'raw_lead:view:org')).toBe(true);
    expect(await resolve(c, 'raw_lead:replay:org')).toBe(true);
    expect(await resolve(c, 'report:create:org')).toBe(true);
  });
});

// --- ForbiddenError ---
describe('ForbiddenError', () => {
  it('is thrown correctly by service contract', () => {
    const err = new ForbiddenError('source:configure:org');
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe('ForbiddenError');
    expect(err.message).toContain('source:configure:org');
  });
});

// --- unknown permission ---
describe('unknown permission', () => {
  it('returns false for completely unknown permission', async () => {
    const c = ctx({ baseRole: 'super_admin', appRoles: ['mih_org_admin'] });
    expect(await resolve(c, 'nonexistent:action:scope')).toBe(false);
  });
});
