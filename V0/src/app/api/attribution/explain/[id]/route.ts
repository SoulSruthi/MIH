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

  const { data: conversionEvent, error: ceError } = await supabase
    .schema('mih')
    .from('conversion_events')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (ceError || !conversionEvent) {
    return NextResponse.json({ error: 'Conversion event not found' }, { status: 404 });
  }

  const { data: attributionResults, error: arError } = await supabase
    .schema('mih')
    .from('attribution_results')
    .select(`
      *,
      attribution_models (
        id, model_code, display_name
      )
    `)
    .eq('org_id', orgId)
    .eq('conversion_event_id', id)
    .order('created_at', { ascending: false });

  if (arError) return NextResponse.json({ error: arError.message }, { status: 500 });

  // Find the best (non-superseded operational) result for computation_inputs
  const results = attributionResults ?? [];
  const bestResult =
    results.find((r) => !r.is_superseded && r.attribution_models?.is_operational) ??
    results.find((r) => !r.is_superseded) ??
    results[0] ??
    null;

  return NextResponse.json({
    conversion_event: conversionEvent,
    attribution_results: results,
    computation_inputs: bestResult?.computation_inputs ?? null,
  });
}
