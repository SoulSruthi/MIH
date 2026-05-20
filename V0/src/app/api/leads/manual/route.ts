import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type ManualLeadItem = {
  name: string;
  phone: string;
  email?: string;
  source_campaign_name?: string;
  notes?: string;
};

type ManualLeadBatchBody = {
  source_id: string;
  leads: ManualLeadItem[];
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as ManualLeadBatchBody;

  if (!body.source_id) {
    return NextResponse.json({ error: 'source_id required' }, { status: 400 });
  }
  if (!Array.isArray(body.leads) || body.leads.length === 0) {
    return NextResponse.json({ error: 'leads array required' }, { status: 400 });
  }
  if (body.leads.length > 500) {
    return NextResponse.json({ error: 'Max 500 leads per batch' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Verify source belongs to this org
  const { data: source } = await supabase
    .from('sources')
    .select('id')
    .eq('id', body.source_id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (!source) return NextResponse.json({ error: 'source not found' }, { status: 404 });

  const now = new Date().toISOString();
  const rows = body.leads.map((lead) => ({
    organization_id: orgId,
    source_id: body.source_id,
    name: lead.name?.trim() || 'Unknown',
    phone_e164: lead.phone?.trim() || '',
    email: lead.email?.trim() || null,
    source_campaign_name: lead.source_campaign_name?.trim() || null,
    raw_payload: lead as Record<string, unknown>,
    ingested_at: now,
    dedup_status: 'pending',
  }));

  const { data, error } = await supabase.from('raw_leads').insert(rows).select('id');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const inserted = data?.length ?? 0;
  return NextResponse.json({
    ok: true,
    inserted,
    message: `${inserted} leads queued for dedup processing`,
  });
}
