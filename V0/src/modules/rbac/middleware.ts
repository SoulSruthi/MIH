import { getTenantContext } from '../tenancy/context.js';
import { resolve, ForbiddenError } from './service.js';
import type { Permission } from './grants.js';

/**
 * Guard for Next.js Server Actions and Route Handlers.
 * Throws ForbiddenError (→ 403) if the current tenant context lacks the permission.
 *
 * Usage:
 *   export async function configureSource(input: unknown) {
 *     await requirePermission('source:configure:org');
 *     // ... proceed
 *   }
 */
export async function requirePermission(action: Permission): Promise<void> {
  const ctx = getTenantContext();
  const allowed = await resolve(ctx, action);
  if (!allowed) throw new ForbiddenError(action);
}

/**
 * Returns true/false without throwing — for conditional UI rendering.
 */
export async function hasPermission(action: Permission): Promise<boolean> {
  try {
    const ctx = getTenantContext();
    return resolve(ctx, action);
  } catch {
    return false;
  }
}
