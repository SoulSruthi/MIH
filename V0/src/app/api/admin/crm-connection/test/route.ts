import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

const CRM_CONNECTOR_ID = 'crm_integration';

type CrmConfig = {
  base_url?: string;
  bearer_token?: string;
};

type ConfigRow = { config: Record<string, unknown> | null };

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('org_connector_configs')
    .select('config')
    .eq('organization_id', orgId)
    .eq('connector_id', CRM_CONNECTOR_ID)
    .maybeSingle() as unknown as { data: ConfigRow | null; error: { message: string } | null };

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const config = (data?.config ?? {}) as CrmConfig;
  const baseUrl = config.base_url?.replace(/\/$/, '');
  const bearerToken = config.bearer_token;

  if (!baseUrl) {
    return NextResponse.json({ ok: false, error: 'CRM base URL not configured' }, { status: 400 });
  }

  try {
    const res = await fetch(`${baseUrl}/health`, {
      method: 'GET',
      headers: bearerToken ? { Authorization: `Bearer ${bearerToken}` } : {},
      signal: AbortSignal.timeout(10_000),
    });

    return NextResponse.json({ ok: res.ok, status: res.status });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Request failed';
    return NextResponse.json({ ok: false, error: message });
  }
}
