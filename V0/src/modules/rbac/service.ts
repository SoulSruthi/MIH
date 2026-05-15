import type { TenantContext } from '../tenancy/context';
import { BASE_ROLE_GRANTS, APP_ROLE_GRANTS } from './grants';
import { getCachedPermissions, setCachedPermissions } from './cache';
import type { Permission } from './grants';

export class ForbiddenError extends Error {
  constructor(action: Permission) {
    super(`Forbidden: missing permission '${action}'`);
    this.name = 'ForbiddenError';
  }
}

/**
 * Resolves whether the given tenant context holds a permission.
 * Layer 1: base role grants
 * Layer 2: any app role grants
 * Layer 3: per-user overrides (stubbed — V1.5)
 */
export async function resolve(
  ctx: TenantContext,
  action: Permission,
): Promise<boolean> {
  // Layer 1: base role
  if (BASE_ROLE_GRANTS[ctx.baseRole]?.has(action)) return true;

  // Layer 2: app roles
  for (const role of ctx.appRoles) {
    if (APP_ROLE_GRANTS[role]?.has(action)) return true;
  }

  // Layer 3: per-user overrides (V1.5+, stubbed)
  return false;
}

/**
 * Resolves all permissions held by the context, using KV cache when available.
 * Used for bulk permission checks (e.g., rendering nav items).
 */
export async function resolveAll(ctx: TenantContext): Promise<Set<Permission>> {
  const cached = await getCachedPermissions(ctx.orgId, ctx.userId);
  if (cached) return new Set(cached);

  const permissions = new Set<Permission>();

  for (const p of BASE_ROLE_GRANTS[ctx.baseRole] ?? []) permissions.add(p);
  for (const role of ctx.appRoles) {
    for (const p of APP_ROLE_GRANTS[role] ?? []) permissions.add(p);
  }

  await setCachedPermissions(ctx.orgId, ctx.userId, [...permissions]);
  return permissions;
}
