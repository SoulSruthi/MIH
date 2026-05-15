import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { getSpendForPeriod, getSpendCompleteness } from '@/modules/spend/index';

function defaultDateRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29); // last 30 days inclusive
  return {
    start: start.toISOString().split('T')[0] as string,
    end: end.toISOString().split('T')[0] as string,
  };
}

function daysBetween(start: string, end: string): number {
  const s = new Date(start);
  const e = new Date(end);
  return Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const defaults = defaultDateRange();
  const start = searchParams.get('start') ?? defaults.start;
  const end = searchParams.get('end') ?? defaults.end;

  const supabase = getSupabaseAdmin();

  // Fetch all enabled sources for this org
  const { data: sources, error: sourcesError } = await supabase
    .from('sources')
    .select('id, name, source_type')
    .eq('organization_id', orgId)
    .eq('is_enabled', true);

  if (sourcesError) return NextResponse.json({ error: sourcesError.message }, { status: 500 });

  const activeDays = daysBetween(start, end);

  const results = await Promise.all(
    (sources ?? []).map(async (source) => {
      const entries = await getSpendForPeriod(supabase, orgId, source.id, start, end);
      const status = getSpendCompleteness(entries, activeDays);
      const totalPaise = entries.reduce((sum, e) => sum + e.amountPaise, 0);
      return {
        source_id: source.id,
        source_name: source.name,
        source_type: source.source_type,
        status,
        total_paise: totalPaise,
      };
    }),
  );

  return NextResponse.json({ start, end, completeness: results });
}
