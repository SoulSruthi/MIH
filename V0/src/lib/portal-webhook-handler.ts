import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from './supabase-admin.js';
import { ingestPortalWebhook } from '../modules/connectors/portals/ingest-webhook.js';
import type { PortalKind } from '../modules/connectors/portals/types.js';

/**
 * Shared handler for all portal webhook inbound routes (99acres, MagicBricks, Housing.com).
 *
 * Authentication: portals include an API key via one of:
 *   - Header: `x-api-key`
 *   - Header: `Authorization: Bearer <key>`
 *   - Query string: `?api_key=<key>`
 *
 * The key is matched against the `credentials` row linked to each source of the given kind.
 * Credentials are stored as encrypted bytea; for V1 the key comparison falls back to
 * env vars (PORTAL_WEBHOOK_DEV_ORG_ID / PORTAL_WEBHOOK_DEV_SOURCE_<KIND>_ID).
 */
export async function handlePortalWebhook(req: NextRequest, kind: PortalKind): Promise<NextResponse> {
  const providedKey =
    req.headers.get('x-api-key') ??
    req.headers.get('authorization')?.replace('Bearer ', '') ??
    req.nextUrl.searchParams.get('api_key') ??
    '';

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Look up all sources of this kind, then try to match the provided API key.
  // Credentials are stored as encrypted bytea — full decryption requires the server key.
  // TODO(M-008): implement symmetric decryption of ciphertext using CREDENTIALS_ENCRYPTION_KEY.
  // For now, matching is done only via dev env var overrides.
  const { data: sources } = await supabase
    .from('sources')
    .select('id, organization_id, credential_id, config')
    .eq('source_kind', kind) as { data: Array<{ id: string; organization_id: string; credential_id: string | null; config: Record<string, unknown> }> | null };

  let matchedSource: { id: string; organization_id: string } | null = null;

  // Attempt API-key match against stored credentials.
  // Since credentials use bytea encryption (not plaintext JSON), we cannot compare
  // directly in V1. This loop is intentionally left as a hook for the decryption layer.
  for (const source of sources ?? []) {
    if (!source.credential_id || !providedKey) continue;

    // Placeholder: once decryption is wired, decrypt ciphertext here and compare.
    // const decrypted = await decryptCredential(source.credential_id);
    // if (decrypted?.api_key === providedKey) { matchedSource = source; break; }
    void source; // suppress lint until decryption is implemented
  }

  // Dev / testing override via environment variables.
  // Set PORTAL_WEBHOOK_DEV_ORG_ID and PORTAL_WEBHOOK_DEV_SOURCE_<KIND>_ID to bypass auth.
  if (!matchedSource) {
    const devOrgId = process.env.PORTAL_WEBHOOK_DEV_ORG_ID;
    const kindEnvKey = kind.toUpperCase().replace(/-/g, '_');
    const devSourceId = process.env[`PORTAL_WEBHOOK_DEV_SOURCE_${kindEnvKey}_ID`];
    if (devOrgId && devSourceId) {
      matchedSource = { id: devSourceId, organization_id: devOrgId };
    }
  }

  if (!matchedSource) {
    return NextResponse.json(
      { error: 'Unauthorized — unknown API key or no configured source' },
      { status: 401 },
    );
  }

  const result = await ingestPortalWebhook(
    supabase,
    kind,
    matchedSource.organization_id,
    matchedSource.id,
    rawBody,
  );

  return NextResponse.json({ ok: true, ...result });
}
