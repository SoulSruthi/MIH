# Source Connector Framework

---

## Design Goals

| Goal | Why |
|---|---|
| One file = one source | Adding Sulekha shouldn't touch ingestion, dedup, or attribution |
| Push + pull symmetric | Meta webhooks; 99acres polls. Same downstream pipeline. |
| Vendor failure must be contained | Meta down ≠ Google Ads down |
| Per-vendor rate-limit awareness | Vendor changes limits; we adapt without redeploying |
| Auth flows are vendor-specific | OAuth2 (Meta), JWT service account (Google), API key (99acres), basic (portals) |
| Replay capability | Bug in mapping → re-run on archived raw payloads |

---

## The Connector Interface

```ts
// modules/connectors/_kernel/types.ts

export interface SourceConnector {
  // Identity
  kind: string;                   // 'meta_lead_ads' | 'google_ads' | '99acres' | ...
  displayName: string;
  vendorDocsUrl: string;
  sourceChannel: SourceChannel;   // 'paid_social' | 'paid_search' | 'aggregator' | ...

  // Auth configuration
  authKind: 'oauth2' | 'api_key' | 'bearer_token' | 'basic';
  credentialFields: CredentialField[];  // displayed in admin UI to guide setup

  // Core operations
  testConnection(creds: DecryptedCredentials, config: SourceConfig): Promise<TestResult>;
  pollLeads(creds: DecryptedCredentials, config: SourceConfig, since: Date): Promise<RawLeadInput[]>;
  normalizePayload(vendorPayload: unknown): RawLeadInput;   // called per lead

  // Optional (not all sources support)
  pollSpend?(creds: DecryptedCredentials, config: SourceConfig, date: Date): Promise<SpendRecord[]>;
  handleWebhook?(body: unknown, headers: Record<string,string>): Promise<RawLeadInput[]>;
  getOAuthAuthorizationUrl?(config: SourceConfig): string;
  exchangeOAuthCode?(code: string, config: SourceConfig): Promise<OAuthTokenSet>;
  refreshOAuthToken?(token: OAuthTokenSet): Promise<OAuthTokenSet>;
}
```

---

## Connector Registry

```ts
// modules/connectors/_kernel/registry.ts

const connectors = new Map<string, SourceConnector>();

export function registerConnector(c: SourceConnector) {
  connectors.set(c.kind, c);
}

export function getConnector(kind: string): SourceConnector {
  const c = connectors.get(kind);
  if (!c) throw new Error(`Unknown connector kind: ${kind}`);
  return c;
}

export function listConnectors(): SourceConnector[] {
  return Array.from(connectors.values());
}
```

Connectors self-register on import:
```ts
// modules/connectors/meta-lead-ads/index.ts
registerConnector(metaLeadAdsConnector);
```

---

## Inngest Poller Pattern

One Inngest cron per connector kind. Each poller:

1. Fetches all `active` sources of this kind across all orgs
2. For each source: calls `connector.pollLeads(creds, config, since)`
3. Passes each raw lead to `modules/ingestion/ingest()`
4. Updates `sources.last_sync_at`, `last_sync_status`, `health_score`
5. On vendor failure: writes to `connector_dlq`, decrements `health_score`

```ts
// modules/connectors/_kernel/poller.ts

export function createPoller(kind: string) {
  return inngest.createFunction(
    { id: `source.${kind}.poll`, concurrency: 10 },
    { cron: '*/5 * * * *' },
    async ({ step }) => {
      const sources = await step.run('fetch-active-sources', () =>
        db.sources.findMany({ where: { source_kind: kind, state: 'active' } })
      );

      await Promise.allSettled(
        sources.map(source => step.run(`poll-${source.id}`, async () => {
          await pollSource(source);
        }))
      );
    }
  );
}
```

---

## Health Scoring

Health score starts at 100, decrements on failures, recovers on success.

| Event | Delta | Notes |
|---|---|---|
| Successful sync | +10 (cap 100) | Recovery |
| Vendor error (5xx, timeout) | -15 | Per occurrence |
| Auth failure (401, 403) | -50 | Requires reconnect |
| Rate limit hit (429) | -5 | Exponential backoff triggered |
| Normalization failure | -5 per lead | Soft failure; lead goes to DLQ |

**Thresholds:**

| Score | Source state | Action |
|---|---|---|
| 100–70 | `active` | Normal |
| 69–30 | `degraded` | Alert org admin |
| < 30 | `paused` | Stop polling; require manual reconnect |
| Auth fail | `revoked` | Immediate stop; require re-OAuth |

---

## DLQ Pattern

Every normalization or ingestion failure writes a `connector_dlq` row:

```ts
await db.connector_dlq.insert({
  organization_id: source.organization_id,
  source_id: source.id,
  failure_stage: 'normalize',
  raw_payload: vendorPayload,
  error_message: error.message,
  error_code: error.code,
  status: 'failed',
});
```

Marketing Ops can view DLQ and replay individual or batch items via `/sources/dlq` UI.

---

## File Structure

```
modules/connectors/
  _kernel/
    types.ts          SourceConnector interface + input types
    registry.ts       registerConnector + getConnector
    poller.ts         createPoller factory
    health.ts         health score update logic
    hmac.ts           webhook HMAC verification
    normalizer.ts     phone E.164 normalization utility
  meta-lead-ads/
    index.ts          registers the connector
    client.ts         Meta Graph API client
    webhook.ts        webhook handler
    normalizer.ts     Meta-specific field mapping
    oauth.ts          Meta Business Login OAuth flow
  google-ads/         (V1)
    ...
  99acres/            (V1)
    ...
```
