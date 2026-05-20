import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const start = searchParams.get('start');
  const end = searchParams.get('end');
  const sourceId = searchParams.get('source_id');

  let query = supabase
    .from('attribution_rollups')
    .select('id, source_id, rollup_date, model_version, unique_lead_count, contacted_count, qualified_count, site_visit_count, deal_count, won_count, won_value_paise, spend_paise, cpl_paise, cpa_paise, roas_times_100, computed_at, sources!source_id(id, name, source_type)')
    .eq('organization_id', orgId)
    .order('rollup_date', { ascending: false });

  if (start) query = query.gte('rollup_date', start);
  if (end) query = query.lte('rollup_date', end);
  if (sourceId) query = query.eq('source_id', sourceId);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rollups: data ?? [] });
}
