# M-011 · Admin UI: Connect Source

**Depends on:** M-003, M-004  
**Effort:** 2 days  
**V5 build prompt:**
```
Build feature: admin UI connect source — /admin/sources page, Meta Lead Ads OAuth
connect button with flow, source state display (unauthorized/authorized/active/degraded),
disconnect action, test-ping action, source health score indicator
```

---

## Purpose

Org admin connects Meta Lead Ads (and future sources) via a self-serve UI.

---

## In Scope

### Page: `/admin/sources`

**Permission required:** `source:configure:org` (mih_org_admin, marketing_ops)

**Source list view:**
- Shows all registered connector kinds
- Each connector shows: connected / not connected
- For connected sources: state badge (active / degraded / paused / revoked), health score bar, last_sync_at, last_sync_status

**Actions per connected source:**
- **Disconnect** — revokes OAuth, sets source.state='revoked'
- **Test ping** — calls `connector.testConnection()`, shows result inline
- **Reconnect** — re-initiates OAuth flow

**Connect flow for Meta Lead Ads:**
1. User clicks "Connect Meta Lead Ads"
2. Redirected to `/api/oauth/meta/start` → Meta Business Login
3. After OAuth: redirected back → credential stored → source.state='authorized'
4. First successful poll → source.state='active'
5. Redirect to `/admin/sources` with success toast

**Source configuration** (post-connect):
- Select Meta Page from dropdown (API-fetched after OAuth)
- Optional: specify form IDs to ingest (empty = all)
- Save config → source.config updated

---

## Acceptance Criteria

```
[ ] /admin/sources: lists all available connector kinds
[ ] Meta connect button → initiates OAuth flow
[ ] After successful OAuth → source row created, state='authorized'
[ ] Source state badges: active=green, degraded=yellow, paused=red, revoked=gray
[ ] Health score bar shown (0-100)
[ ] Test ping → shows "Connected ✓" or error inline
[ ] Disconnect → sets state='revoked', removes credential
[ ] Marketing_ops can connect sources
[ ] Org_viewer CANNOT see /admin/sources → 403 redirect to /dashboard
[ ] Page accessible only to mih_org_admin and marketing_ops
```

---

## UI Components

- shadcn `Card`, `Badge`, `Button`, `Dialog` (for disconnect confirmation)
- shadcn `Progress` bar for health score

---

## Module Location

```
app/(app)/admin/sources/
  page.tsx
  _components/
    source-card.tsx
    connect-meta-button.tsx
    source-config-form.tsx
app/api/oauth/meta/
  start/route.ts
  callback/route.ts
```
