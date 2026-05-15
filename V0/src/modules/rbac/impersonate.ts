/**
 * Super admin impersonation flow — scaffolded here; implemented in M-011.
 *
 * When a super_admin impersonates an org, they receive a scoped JWT with
 * organization_id set and base_role='org_user'. All audit_log rows written
 * during impersonation carry actor_type='super_admin_impersonation' + the
 * original super admin user_id in meta.
 */

export type ImpersonationSession = {
  superAdminUserId: string;
  targetOrgId: string;
  targetUserId: string;
  expiresAt: Date;
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function startImpersonation(_session: ImpersonationSession): Promise<never> {
  throw new Error('Impersonation not yet implemented — see M-011');
}
