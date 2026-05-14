import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// V0 stub: records unmerge intent in audit_log but does not re-process the lead.
// Full unmerge (re-ingestion + new unique_lead creation) is a V1 feature.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { raw_lead_id: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.raw_lead_id) {
    return NextResponse.json({ error: 'raw_lead_id is required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Verify the raw_lead exists and belongs to this org
  const { data: rawLead, error: fetchErr } = await supabase
    .from('raw_leads')
    .select('id, dedup_status, unique_lead_id')
    .eq('id', body.raw_lead_id)
    .eq('organization_id', orgId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  if (!rawLead) return NextResponse.json({ error: 'raw_lead not found' }, { status: 404 });
  if (rawLead.dedup_status !== 'duplicate') {
    return NextResponse.json({ error: 'raw_lead is not a duplicate' }, { status: 422 });
  }

  const { data: auditRow, error: auditErr } = await supabase
    .from('audit_log')
    .insert({
      organization_id: orgId,
      actor_type: 'admin',
      action: 'dedup.unmerge_requested',
      table_name: 'raw_leads',
      record_id: body.raw_lead_id,
      request_id: crypto.randomUUID(),
      after_state: {
        raw_lead_id: body.raw_lead_id,
        unique_lead_id: rawLead.unique_lead_id,
        note: 'V0 stub — manual re-processing required',
      },
    })
    .select('id')
    .single();

  if (auditErr) return NextResponse.json({ error: auditErr.message }, { status: 500 });

  return NextResponse.json({
    ok: true,
    audit_entry_id: auditRow.id,
    message: 'Unmerge request logged. Manual re-processing required (V0 stub).',
  });
}
