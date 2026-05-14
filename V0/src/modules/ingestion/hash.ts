import { createHash } from 'crypto';

export type HashInput = {
  sourceId: string;
  phoneE164: string;
  email?: string;
  name: string;
  sourceReceivedAt: Date;
};

/**
 * Deterministic SHA-256 over the canonical lead identity fields.
 * Same inputs → same hash, always. Used for idempotency on retries.
 */
export function computePayloadHash(input: HashInput): string {
  const canonical = JSON.stringify({
    source_id: input.sourceId,
    phone_e164: input.phoneE164,
    email: input.email ?? null,
    name: input.name,
    source_received_at: input.sourceReceivedAt.toISOString(),
  });
  return createHash('sha256').update(canonical).digest('hex');
}
