# CRM ↔ MIH Integration Contract Overview

**Status:** Locked for V0. Additive changes only post-V0-ship.

---

## Architecture Summary

Two webhooks. Both HMAC-signed. Both idempotent. Both audit-logged on both sides.

```
   ┌──────────┐     POST /api/sister/v1/leads     ┌──────────┐
   │   MIH    │ ─────────────────────────────────▶│  AI CRM  │
   │          │                                   │          │
   │          │◀─────────────────────────────────-│          │
   └──────────┘     POST /api/crm/events          └──────────┘
       (MIH inbox)                              (CRM outbound)
```

---

## Auth Model

### MIH → CRM

- **Type:** Bearer token, issued by CRM org admin in CRM UI
- **Scope:** Scoped to `product_kind='marketing_intelligence_hub'` + one `organization_id`
- **Header:** `Authorization: Bearer <token>`
- **Storage:** CRM stores SHA-256 hash; raw token shown once
- **Rotation:** 30-day default TTL; 30-day grace window; one-click rotate

### CRM → MIH

- **Type:** Bearer token, issued by MIH
- **Scope:** Scoped to `product_kind='ai_crm'` + one `organization_id`
- **Header:** `Authorization: Bearer <token>`

### HMAC (additional defense in depth)

Both directions use HMAC on top of bearer auth:

- **Header:** `X-Builtrix-Signature: sha256=<hex>`
- **Computation:** `hmac_sha256(per-org-secret, raw_body)`
- **Replay protection:** `X-Builtrix-Timestamp` (ISO 8601); reject if > 5 min old

---

## Security Checklist

| Concern | Mitigation |
|---|---|
| Cross-tenant leak | Token scoped to one org_id; both sides validate token ↔ org_id match |
| Replay attack | HMAC + 5-min timestamp window |
| Token leak | Hashed at rest; rotation with 30-day grace |
| MIH compromised | Per-org rate limit on CRM side; CRM admin can disable token in 1 click |
| CRM compromised | Same, reverse direction |
| PII in transit | TLS 1.3; both sides log event_id only, not full bodies |
| Data residency | Both products in Mumbai region |

---

## Schema Versioning

Current version: **v1**. Schema changes are additive only (new optional fields). Breaking changes require `/api/sister/v2/leads`.

---

## Detailed Specs

- `plans/integration/mih-to-crm.md` — POST /api/sister/v1/leads (request + response)
- `plans/integration/crm-to-mih.md` — POST /api/crm/events (all event kinds)
- `plans/integration/auth.md` — Auth + HMAC implementation
