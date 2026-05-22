import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const url = new URL(req.url);
  const projectId = url.searchParams.get('project_id');
  const sourceId = url.searchParams.get('source_id');
  const medium = url.searchParams.get('medium');
  const periodStart = url.searchParams.get('period_start');
  const periodEnd = url.searchParams.get('period_end');

  try {
    const supabase = getSupabaseAdmin();
    let query = supabase
      .schema('mih')
      .from('spend_entries')
      .select('*')
      .eq('org_id', orgId)
      .order('period_start', { ascending: false });

    if (projectId) query = query.eq('project_id', projectId);
    if (sourceId) query = query.eq('source_id', sourceId);
    if (medium) query = query.eq('medium', medium);
    if (periodStart) query = query.gte('period_start', periodStart);
    if (periodEnd) query = query.lte('period_end', periodEnd);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entries: data ?? [] });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.amount_paise || !body.period_start || !body.period_end || !body.entry_kind) {
    return NextResponse.json(
      { error: 'amount_paise, period_start, period_end, entry_kind are required' },
      { status: 400 },
    );
  }

  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .schema('mih')
      .from('spend_entries')
      .insert({
        org_id: orgId,
        project_id: body.project_id ?? null,
        source_id: body.source_id ?? null,
        medium: body.medium ?? null,
        entry_kind: body.entry_kind,
        amount_paise: body.amount_paise,
        period_start: body.period_start,
        period_end: body.period_end,
        ingestion_source: body.ingestion_source ?? null,
        external_ref: body.external_ref ?? null,
        description: body.description ?? null,
        contract_id: body.contract_id ?? null,
        created_by: body.created_by ?? null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ entry: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
