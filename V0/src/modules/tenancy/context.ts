import { AsyncLocalStorage } from 'async_hooks';

export type BaseRole = 'super_admin' | 'org_user';
export type MIHRole =
  | 'mih_org_admin'
  | 'marketing_manager'
  | 'marketing_analyst'
  | 'marketing_ops'
  | 'org_viewer';
export type Permission = string;

export type TenantContext = {
  orgId: string;
  userId: string;
  baseRole: BaseRole;
  appRoles: MIHRole[];
  permissions: Permission[];
  isolation: 'pool' | 'silo';
  tier: 'standard' | 'enterprise';
  requestId: string;
};

const store = new AsyncLocalStorage<TenantContext>();

export function runWithTenantContext<T>(ctx: TenantContext, fn: () => T): T {
  return store.run(ctx, fn);
}

export function getTenantContext(): TenantContext {
  const ctx = store.getStore();
  if (!ctx) throw new Error('No TenantContext — must be called within runWithTenantContext');
  return ctx;
}

export function getTenantContextOrNull(): TenantContext | null {
  return store.getStore() ?? null;
}
