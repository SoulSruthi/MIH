# RLS Patterns

Standard patterns for every tenant-scoped table. Apply identically everywhere.

---

## The Core Pattern (apply to every new table)

```sql
-- 1) Ensure organization_id column exists with NOT NULL + FK
ALTER TABLE <table_name>
  ADD COLUMN organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE;

-- 2) Enable RLS
ALTER TABLE <table_name> ENABLE ROW LEVEL SECURITY;

-- 3) Default-deny + tenant-scoped allow
CREATE POLICY <table_name>_tenant_isolation ON <table_name>
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

-- 4) Index for hot-path queries
CREATE INDEX <table_name>_org_idx ON <table_name>(organization_id, <sort_col> DESC);
```

---

## The app_org_id() Function (created once in M-001)

```sql
CREATE OR REPLACE FUNCTION public.app_org_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT NULLIF(
    current_setting('request.jwt.claims', true)::json->>'organization_id',
    ''
  )::uuid
$$;
```

This function reads `organization_id` from the JWT custom claim. When a user's JWT is set as the Supabase client session, every query automatically runs through this function.

**Behavior matrix:**

| JWT state | app_org_id() returns | Query result |
|---|---|---|
| Valid JWT with `organization_id` | org UUID | User sees their org data |
| Valid JWT, no `organization_id` claim | NULL | Query returns zero rows |
| No JWT (anonymous) | NULL | Query returns zero rows |
| Service role (bypasses RLS) | N/A | Returns all rows (super admin operations only) |

---

## Super Admin Access Pattern

Super admins use the **service role key** for platform operations, which bypasses RLS by design. However:

1. All service-role queries must explicitly filter by `organization_id` in app code (defense in depth)
2. The impersonation flow sets a scoped JWT when a super admin views an org's data
3. Every service-role query for org data logs an audit row

```ts
// Super admin querying a specific org — always explicit filter
const { data } = await supabaseAdmin
  .from('unique_leads')
  .select('*')
  .eq('organization_id', targetOrgId)  // ALWAYS explicit even with service role
  .limit(100);
```

---

## Testing RLS Isolation (required in every M-NNN directive)

```ts
// tests/rls/<table>.test.ts — standard cross-tenant isolation test

describe('<table> RLS isolation', () => {
  it('org A cannot read org B rows', async () => {
    const { orgAClient, orgBData } = await setupTwoOrgs();
    const { data, error } = await orgAClient.from('<table>').select().eq('id', orgBData.id);
    expect(data).toHaveLength(0);
    expect(error).toBeNull();
  });

  it('org A cannot insert rows for org B', async () => {
    const { orgAClient, orgB } = await setupTwoOrgs();
    const { error } = await orgAClient.from('<table>').insert({
      organization_id: orgB.id,
      // ... other fields
    });
    expect(error).not.toBeNull();
  });

  it('super admin service role sees all rows', async () => {
    const { orgA, orgB } = await setupTwoOrgs();
    const { data } = await supabaseAdmin.from('<table>').select();
    expect(data!.length).toBeGreaterThanOrEqual(2);
  });
});
```

---

## Tables That Intentionally Do NOT Have Row-Level RLS

| Table | Why no RLS | Access control |
|---|---|---|
| `organizations` | Platform-level table; org admin reads their own via app layer; super admin via service role | App-layer filter + service role |
| `audit_log` | Partitioned table; complex RLS on partitioned tables is a Postgres footgun | Service role only; app surfaces filtered view |

These tables must be accessed via server-side code only — never expose to client-side Supabase queries.
