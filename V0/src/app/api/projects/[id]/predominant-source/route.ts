import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const event_code = searchParams.get('event_code') ?? 'deal_won';
  const periods = parseInt(searchParams.get('periods') ?? '12');

  // Verify the project exists and belongs to this org
  const { data: project, error: projectError } = await supabase
    .schema('mih')
    .from('projects')
    .select('id')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (projectError || !project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const since = new Date();
  since.setMonth(since.getMonth() - periods);

  const { data: rows, error } = await supabase
    .schema('mih')
    .from('project_source_history')
    .select('source_id, bookings_count, bookings_value')
    .eq('org_id', orgId)
    .eq('project_id', id)
    .eq('event_code', event_code)
    .gte('period_start', since.toISOString().split('T')[0]);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Aggregate by source_id
  const aggregated = new Map<string, { bookings_count: number; bookings_value: number }>();
  for (const row of rows ?? []) {
    const existing = aggregated.get(row.source_id) ?? { bookings_count: 0, bookings_value: 0 };
    aggregated.set(row.source_id, {
      bookings_count: existing.bookings_count + (row.bookings_count ?? 0),
      bookings_value: existing.bookings_value + (row.bookings_value ?? 0),
    });
  }

  const total_count = [...aggregated.values()].reduce((s, r) => s + r.bookings_count, 0);

  const ranked = [...aggregated.entries()]
    .map(([source_id, agg]) => ({
      source_id,
      bookings_count: agg.bookings_count,
      bookings_value: agg.bookings_value,
      pct_of_total: total_count > 0 ? Math.round((agg.bookings_count / total_count) * 10000) / 100 : 0,
    }))
    .sort((a, b) => b.bookings_count - a.bookings_count);

  return NextResponse.json({ sources: ranked, event_code, periods, total_count });
}
