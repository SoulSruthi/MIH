# M-012 · Admin UI: CRM Connection Config

**Depends on:** M-008, M-009  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: admin UI CRM connection config — /admin/crm-connection page,
form for CRM org_id + base_url + bearer token + HMAC secret, test ping,
encrypted credential storage, connection status display
```

---

## Purpose

Org admin enters CRM connection details so MIH can hand off leads and receive lifecycle events.

---

## In Scope

### Page: `/admin/crm-connection`

**Permission required:** `crm_connection:configure:org` (mih_org_admin only)

### Form fields
1. **CRM Org ID** — UUID of the CRM organization
2. **CRM Base URL** — default `https://crm.builtrix.io`, overridable for staging
3. **Bearer Token** — issued by CRM org admin in CRM UI (shown once there)
4. **HMAC Secret** — shared secret for signing outbound requests + verifying inbound events

### Save action
1. Encrypt bearer token via AES-256-GCM → store in `credentials` (kind='bearer_token')
2. Encrypt HMAC secret → store in `credentials` (kind='hmac_secret')
3. Update `organizations.crm_organization_id`, `crm_base_url`, `crm_api_token_id`, `crm_hmac_secret_id`
4. SSRF guard: validate `crm_base_url` is not a private IP
5. Fire `audit_log`: `action='crm_connection.configured'`
6. Show success toast

### Test ping action
- POST test request to `<crm_base_url>/api/sister/v1/health` with bearer token
- Display: "✓ CRM is reachable" or "✗ <error message>"

### Connection status display
- Shows current connection state: `not_configured` / `configured` / `verified`
- Shows last successful handoff timestamp
- Shows last 3 handoff failures (if any) with error summary

### Token rotation
- "Rotate Token" button: enter new token → encrypt + store → `credentials.rotated_at` updated
- Old token continues to work for 30 days (grace window; CRM enforces)
- `audit_log`: `action='crm_connection.token_rotated'`

---

## Acceptance Criteria

```
[ ] Save form → bearer token + HMAC secret encrypted in credentials table
[ ] Bearer token never returned in API responses (write-only field)
[ ] Test ping success → shows "CRM is reachable"
[ ] Test ping failure → shows error message inline
[ ] Private IP in base_url → rejected with clear error
[ ] Rotate token: new token stored, old credential rotated_at set
[ ] marketing_ops CANNOT see /admin/crm-connection (mih_org_admin only)
[ ] Connection status widget shows correct state
[ ] audit_log row on every configuration change
```

---

## UI Components

- shadcn `Form`, `Input`, `Button`, `Alert`, `Badge`
- Password-type input for bearer token + HMAC secret (never show stored value)

---

## Module Location

```
app/(app)/admin/crm-connection/
  page.tsx
  _components/
    crm-config-form.tsx
    connection-status.tsx
    rotate-token-dialog.tsx
modules/tenancy/
  crm-config.ts    get/set/rotate CRM connection config
```
