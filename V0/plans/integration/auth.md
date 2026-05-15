# Integration Auth — Bearer + HMAC Implementation

---

## MIH → CRM: Bearer Token Auth

All requests from MIH to CRM use a static bearer token negotiated at org setup time.

### Token Storage
```
credentials table: encrypted AES-256-GCM
key:   'crm_bearer_token'
value: ciphertext
```

### Request Header
```http
POST https://crm.example.com/api/sister/v1/leads
Authorization: Bearer {decrypted_crm_bearer_token}
X-MIH-Org-Id: {organization_id}
X-MIH-Idempotency-Key: {idempotency_key}
Content-Type: application/json
```

### Token Rotation
- CRM rotates token → sends new token via `system.token_rotated` event to MIH webhook
- MIH re-encrypts and stores new token
- Old token remains valid for 24h overlap period (CRM responsibility)

---

## CRM → MIH: HMAC-SHA256 Verification

All inbound webhook requests from CRM must pass HMAC verification before processing.

### Shared Secret
```
Per-org shared secret stored in credentials table:
key:   'crm_webhook_secret'
value: AES-256-GCM ciphertext (32-byte random secret)
```

### Signature Generation (CRM side)
```
HMAC-SHA256(
  key   = shared_secret,
  data  = request_body_raw_bytes
)
→ hex-encoded digest
→ sent as: X-MIH-Signature: sha256={digest}
```

### Verification (MIH side)

```typescript
import { createHmac, timingSafeEqual } from 'crypto';

export function verifyWebhookSignature(
  body: Buffer,           // raw request body bytes (before JSON.parse)
  signature: string,      // X-MIH-Signature header value
  secret: string          // decrypted shared secret
): boolean {
  const expected = `sha256=${createHmac('sha256', secret).update(body).digest('hex')}`;
  if (expected.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
}
```

### Timestamp Window Check

```typescript
export function verifyTimestamp(
  timestampHeader: string,   // X-MIH-Timestamp: Unix seconds
  windowSeconds = 300        // 5-minute window
): boolean {
  const ts = parseInt(timestampHeader, 10);
  if (isNaN(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  return Math.abs(now - ts) <= windowSeconds;
}
```

Combined check in webhook handler:
```typescript
export async function POST(req: NextRequest) {
  const rawBody = await req.arrayBuffer();
  const body = Buffer.from(rawBody);

  const sig = req.headers.get('x-mih-signature') ?? '';
  const ts  = req.headers.get('x-mih-timestamp') ?? '';

  if (!verifyTimestamp(ts)) return new Response('Timestamp out of window', { status: 401 });

  const secret = await getDecryptedSecret(orgId, 'crm_webhook_secret');
  if (!verifyWebhookSignature(body, sig, secret)) return new Response('Invalid signature', { status: 401 });

  // Process event...
}
```

---

## Idempotency

Both directions use idempotency keys to prevent duplicate processing.

### MIH → CRM
```
X-MIH-Idempotency-Key: {sha256(unique_lead_id + ':' + event_type + ':' + attempt_number)}
```
CRM caches this key for 24h; duplicate key → 200 with original response.

### CRM → MIH
```
X-CRM-Event-Id: {uuid from CRM}
```
MIH stores processed event IDs in `crm_event_log` table with unique constraint on `(organization_id, crm_event_id)`. Duplicate → 200, no re-processing.

---

## Error Response Contract

| Scenario | MIH HTTP Response | Action |
|---|---|---|
| Valid HMAC, valid payload | 200 OK | Process event |
| Invalid HMAC | 401 Unauthorized | CRM should not retry |
| Timestamp expired | 401 Unauthorized | CRM should not retry |
| Valid HMAC, malformed payload | 422 Unprocessable | CRM should not retry |
| Valid, but MIH internal error | 500 Internal Server Error | CRM retries with backoff |
| Rate limited | 429 Too Many Requests | CRM retries after Retry-After header |
