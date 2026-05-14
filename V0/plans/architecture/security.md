# Security Architecture

Every directive includes tests for these controls. Non-optional.

---

## Defense Layers

| Concern | Implementation | Where enforced |
|---|---|---|
| Cross-tenant data leak | RLS on every table + app-layer `organization_id` filter + nightly `tenant_leak_check()` audit | DB + app + cron |
| Credential storage | AES-256-GCM app-layer encryption; key stored in Supabase Vault; DB only ever sees ciphertext | `credentials` table + `modules/tenancy/crypto.ts` |
| Webhook HMAC verification | SHA-256 HMAC + 5-min timestamp window on all inbound webhooks (`/api/inbound/*`, `/api/crm/events`) | Route handler entry |
| Replay attack on webhooks | HMAC + timestamp window + `event_id` idempotency (deduped in Upstash KV + DB) | Route handler + DB UNIQUE |
| SSRF on configured URLs | DNS-rebinding guard before any outbound call to operator-configured CRM URL | `modules/crm-handoff/dns-guard.ts` |
| Secret in bash/logs | V5 hooks block secret patterns; logs redact PII; never log full payloads | Hook + structured logging |
| Super-admin data access | Impersonation flow: reason required + audit row + 1h time bound + UI banner | `modules/rbac/impersonate.ts` |
| Token rotation | 30-day default TTL, 30-day grace window on rotation, one-click rotate in UI | `credentials` table + UI |
| PII in transit | TLS 1.3 only; Vercel enforces; Supabase enforces | Infrastructure |
| PII in logs | Log event_id + key fields only; never log phone, email, full payload | Logging policy + code review |
| Right to erasure (DPDP) | `anonymize_unique_lead(id)` RPC: nulls phone/email/name, retains attribution stats | Supabase RPC |
| AI prompt injection (V2+) | All LLM inputs sanitized before passing to Anthropic/OpenAI | `modules/ai/sanitize.ts` (V2) |
| Rate limiting | Per-org + per-token sliding window via Upstash KV on all API endpoints | `modules/rbac/rate-limit.ts` |

---

## HMAC Verification Pattern (standard across all inbound webhooks)

```ts
// modules/connectors/_kernel/hmac.ts

export function verifyWebhookSignature(
  rawBody: string,
  signature: string,   // X-Builtrix-Signature: sha256=<hex>
  timestamp: string,   // X-Builtrix-Timestamp: ISO 8601
  secret: string
): boolean {
  // 1. Reject if timestamp > 5 minutes old
  const ts = new Date(timestamp).getTime();
  if (Date.now() - ts > 5 * 60 * 1000) return false;

  // 2. Compute expected HMAC
  const expected = createHmac('sha256', secret)
    .update(rawBody)
    .digest('hex');

  // 3. Constant-time comparison
  return timingSafeEqual(
    Buffer.from(signature.replace('sha256=', '')),
    Buffer.from(expected)
  );
}
```

---

## Credential Encryption Pattern

```ts
// modules/tenancy/crypto.ts — AES-256-GCM

const KEY = await getVaultKey();  // Supabase Vault, never in env vars

export async function encryptCredential(plaintext: string): Promise<{ ciphertext: Buffer; nonce: Buffer }> {
  const nonce = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', KEY, nonce);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { ciphertext, nonce };
}

export async function decryptCredential(ciphertext: Buffer, nonce: Buffer): Promise<string> {
  const authTag = ciphertext.subarray(ciphertext.length - 16);
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', KEY, nonce);
  decipher.setAuthTag(authTag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
```

---

## Super Admin Impersonation Flow

1. Super admin navigates to `/platform/orgs/{id}/impersonate`
2. System requires reason text (min 20 chars, non-empty) → blocks without it
3. System writes `audit_log` row with `action='impersonation.started'`, `actor_id`, `organization_id`, `reason`, `expires_at`
4. This audit row is readable by the target org's admin
5. UI renders a persistent red banner: **"You are viewing [Org Name] as Builtrix Admin (expires in 58 min)"**
6. All actions during impersonation write audit rows with `impersonator_id` field
7. After 1 hour, session reverts to super admin context automatically

---

## Security Checklist per Directive

Every directive M-NNN must include tests for:

- [ ] Cross-tenant isolation: org A cannot read/write org B's data for every new table
- [ ] RLS policy exists on every new tenant-scoped table
- [ ] Webhook endpoints verify HMAC before processing
- [ ] Credentials never logged, never in plaintext in DB
- [ ] All inputs validated at boundary (Zod schemas)
- [ ] Rate limiting applied on public-facing endpoints
