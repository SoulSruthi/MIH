import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// CRM config is stored in org_connector_configs using a virtual connector_id = 'crm_integration'.
// We use the config jsonb column to store all CRM connection settings.
// The HMAC secret is stored there too (not encrypted in V1 — acceptable for internal admin).

const CRM_CONNECTOR_ID = 'crm_integration';

type CrmConfig = {
  crm_org_id?: string;
  base_url?: string;
  bearer_token?: string;
  hmac_secret?: string;
};

type ConfigRow = { config: Record<string, unknown> | null };

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('org_connector_configs')
    .select('config')
    .eq('organization_id', orgId)
    .eq('connector_id', CRM_CONNECTOR_ID)
    .maybeSingle() as unknown as { data: ConfigRow | null; error: { message: string } | null };

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const config = (data?.config ?? {}) as CrmConfig;

  return NextResponse.json({
    crm_org_id: config.crm_org_id ?? '',
    base_url: config.base_url ?? '',
    bearer_token: config.bearer_token ?? '',
    hmac_secret: config.hmac_secret ?? '',
  });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  let body: CrmConfig;
  try {
    body = (await req.json()) as CrmConfig;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // First, ensure the crm_integration connector_definition exists (upsert if needed)
  await supabase.from('connector_definitions').upsert(
    {
      id: CRM_CONNECTOR_ID,
      display_name: 'CRM Integration',
      auth_kind: 'bearer_token',
      supports_auto_fetch: false,
      supports_spend_tracking: false,
      is_active: true,
    } as unknown as never,
    { onConflict: 'id' },
  );

  const { error } = await supabase
    .from('org_connector_configs')
    .upsert(
      {
        organization_id: orgId,
        connector_id: CRM_CONNECTOR_ID,
        is_enabled: true,
        config: {
          crm_org_id: body.crm_org_id ?? '',
          base_url: body.base_url ?? '',
          bearer_token: body.bearer_token ?? '',
          hmac_secret: body.hmac_secret ?? '',
        },
        updated_at: new Date().toISOString(),
      } as unknown as never,
      { onConflict: 'organization_id,connector_id' },
    );

  if (error) return NextResponse.json({ error: (error as { message: string }).message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
