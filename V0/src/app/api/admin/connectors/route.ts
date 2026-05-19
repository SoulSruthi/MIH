import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type CredentialField = {
  field: string;
  label: string;
  type: string;
  required: boolean;
};

export type ConnectorWithStatus = {
  id: string;
  display_name: string;
  auth_kind: string;
  supports_auto_fetch: boolean;
  supports_spend_tracking: boolean;
  vendor_docs_url: string | null;
  credential_schema: CredentialField[];
  // org-specific
  is_enabled: boolean;
  config: Record<string, unknown>;
  has_credentials: boolean;
  last_synced_at: string | null;
  last_sync_error: string | null;
  health_score: number | null;
  org_config_id: string | null;
};

type ConnectorDefinitionRow = {
  id: string;
  display_name: string;
  auth_kind: string;
  supports_auto_fetch: boolean;
  supports_spend_tracking: boolean;
  vendor_docs_url: string | null;
  credential_schema: CredentialField[] | null;
};

type OrgConnectorConfigRow = {
  id: string;
  connector_id: string;
  is_enabled: boolean;
  config: Record<string, unknown> | null;
  credentials_encrypted: string | null;
  last_synced_at: string | null;
  last_sync_error: string | null;
  health_score: number | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: defs, error: defsErr } = await supabase
    .from('connector_definitions')
    .select('id, display_name, auth_kind, supports_auto_fetch, supports_spend_tracking, vendor_docs_url, credential_schema')
    .eq('is_active', true)
    .order('display_name');

  if (defsErr) return NextResponse.json({ error: defsErr.message }, { status: 500 });

  const { data: orgConfigs } = await supabase
    .from('org_connector_configs')
    .select('id, connector_id, is_enabled, config, credentials_encrypted, last_synced_at, last_sync_error, health_score')
    .eq('organization_id', orgId);

  const configByKind = new Map(
    ((orgConfigs ?? []) as OrgConnectorConfigRow[]).map((c) => [c.connector_id, c]),
  );

  const connectors: ConnectorWithStatus[] = ((defs ?? []) as ConnectorDefinitionRow[]).map((def) => {
    const orgCfg = configByKind.get(def.id);
    return {
      id: def.id,
      display_name: def.display_name,
      auth_kind: def.auth_kind,
      supports_auto_fetch: def.supports_auto_fetch,
      supports_spend_tracking: def.supports_spend_tracking,
      vendor_docs_url: def.vendor_docs_url,
      credential_schema: def.credential_schema ?? [],
      is_enabled: orgCfg?.is_enabled ?? false,
      config: orgCfg?.config ?? {},
      has_credentials: !!(orgCfg?.credentials_encrypted ?? (orgCfg?.config as Record<string, unknown> | null)?.access_token),
      last_synced_at: orgCfg?.last_synced_at ?? null,
      last_sync_error: orgCfg?.last_sync_error ?? null,
      health_score: orgCfg?.health_score ?? null,
      org_config_id: orgCfg?.id ?? null,
    };
  });

  return NextResponse.json({ connectors });
}

type ToggleBody = {
  connector_id: string;
  is_enabled: boolean;
  config?: Record<string, unknown>;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as ToggleBody;
  if (!body.connector_id) return NextResponse.json({ error: 'connector_id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from('org_connector_configs')
    .upsert(
      {
        organization_id: orgId,
        connector_id: body.connector_id,
        is_enabled: body.is_enabled,
        config: body.config ?? {},
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,connector_id' },
    )
    .select('id, connector_id, is_enabled')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
