import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  // Total counts by processing_state
  const { data: stateCounts, error: stateErr } = await supabase
    .schema('mih')
    .from('raw_inbox')
    .select('processing_state')
    .eq('org_id', orgId);

  if (stateErr) return NextResponse.json({ error: stateErr.message }, { status: 500 });

  const counts = (stateCounts ?? []).reduce(
    (acc: Record<string, number>, row: { processing_state: string }) => {
      acc[row.processing_state] = (acc[row.processing_state] ?? 0) + 1;
      return acc;
    },
    {},
  );

  const total = Object.values(counts).reduce((a, b) => a + b, 0);

  // Counts by source
  const { data: sourceCounts, error: sourceErr } = await supabase
    .schema('mih')
    .from('raw_inbox')
    .select('source_id, processing_state')
    .eq('org_id', orgId)
    .not('source_id', 'is', null);

  if (sourceErr) return NextResponse.json({ error: sourceErr.message }, { status: 500 });

  const bySource = (sourceCounts ?? []).reduce(
    (acc: Record<string, { total: number; pending: number; rejected: number }>, row: { source_id: string; processing_state: string }) => {
      if (!acc[row.source_id]) {
        acc[row.source_id] = { total: 0, pending: 0, rejected: 0 };
      }
      acc[row.source_id].total++;
      if (row.processing_state === 'pending') acc[row.source_id].pending++;
      if (row.processing_state === 'rejected') acc[row.source_id].rejected++;
      return acc;
    },
    {},
  );

  return NextResponse.json({
    total,
    by_state: counts,
    by_source: bySource,
  });
}
