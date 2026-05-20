import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type DedupPreview = {
  window_hours: number;
  total_leads_last_week: number;
  would_be_duplicates: number;
  dedup_rate_pct: number | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const windowHours = Math.min(
    720,
    Math.max(1, parseInt(searchParams.get('window_hours') ?? '24', 10)),
  );

  const supabase = getSupabaseAdmin();

  const weekAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();

  // Count total raw_leads in last 7 days
  const { count: totalCount } = await supabase
    .from('raw_leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .gte('ingested_at', weekAgo);

  // Count those marked as duplicate
  const { count: dupCount } = await supabase
    .from('raw_leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('dedup_status', 'duplicate')
    .gte('ingested_at', weekAgo);

  const total = totalCount ?? 0;
  const duplicates = dupCount ?? 0;
  const rate = total > 0 ? Math.round((duplicates / total) * 100 * 10) / 10 : null;

  const preview: DedupPreview = {
    window_hours: windowHours,
    total_leads_last_week: total,
    would_be_duplicates: duplicates,
    dedup_rate_pct: rate,
  };

  return NextResponse.json(preview);
}
