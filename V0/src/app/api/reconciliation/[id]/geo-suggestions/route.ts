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
  const supabase = getSupabaseAdmin();

  // Fetch the reconciliation item to get project_id from context
  const { data: item, error: itemErr } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('id, item_type, context')
    .eq('id', id)
    .eq('org_id', orgId)
    .single();

  if (itemErr || !item) return NextResponse.json({ error: 'Item not found' }, { status: 404 });

  const ctx = (item as Record<string, unknown>).context as Record<string, unknown> ?? {};
  const projectId = ctx.project_id as string | null;

  // Fetch active sources for this org (optionally filtered by project)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = supabase
    .schema('mih')
    .from('project_source_allowlist')
    .select('id, source_id, project_id, is_active, sources!inner(id, name, taxonomy_path, geo_lat, geo_lng)')
    .eq('org_id', orgId)
    .eq('is_active', true);

  if (projectId) query = query.eq('project_id', projectId);

  const { data: allowlist } = await query.limit(20) as { data: Record<string, unknown>[] | null };

  const suggestions = (allowlist ?? []).map((row: Record<string, unknown>) => {
    const source = (row.sources as Record<string, unknown>) ?? {};
    return {
      source_id: row.source_id,
      project_id: row.project_id,
      source_name: source.name ?? 'Unknown Source',
      taxonomy_path: source.taxonomy_path ?? null,
      geo_lat: source.geo_lat ?? null,
      geo_lng: source.geo_lng ?? null,
      is_active: row.is_active,
    };
  });

  return NextResponse.json({ suggestions, item_id: id, project_id: projectId });
}
