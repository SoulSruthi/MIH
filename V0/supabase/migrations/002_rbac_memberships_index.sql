-- =================================================================
-- Migration: 002_rbac_memberships_index
-- Directive: M-002 RBAC Engine
-- Rule: ADDITIVE ONLY
-- =================================================================

-- Hot-path index: resolve all app_roles for a user in an org (used on every request)
CREATE INDEX IF NOT EXISTS memberships_user_org_idx
  ON memberships(user_id, organization_id)
  WHERE status = 'active';

-- Index for listing all members in an org (used by admin UI)
CREATE INDEX IF NOT EXISTS memberships_org_status_idx
  ON memberships(organization_id, status);

-- GIN index on app_roles array (used for role-based queries, e.g. "list all org admins")
CREATE INDEX IF NOT EXISTS memberships_app_roles_gin_idx
  ON memberships USING GIN(app_roles);
