import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface ReversalBody {
  reason: string;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { id } = await params;

  let body: ReversalBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 1. Validate body.reason
  if (!body.reason) {
    return NextResponse.json({ error: 'reason is required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // 2. Verify the conversion_event exists, belongs to org, and is NOT already reversed
  const { data: conversionEvent, error: ceError } = await supabase
    .schema('mih')
    .from('conversion_events')
    .select('id, cluster_id, reversed_at')
    .eq('org_id', orgId)
    .eq('id', id)
    .single();

  if (ceError || !conversionEvent) {
    return NextResponse.json({ error: 'Conversion event not found' }, { status: 404 });
  }

  const ce = conversionEvent as Record<string, unknown>;

  if (ce.reversed_at !== null && ce.reversed_at !== undefined) {
    return NextResponse.json({ error: 'Conversion event is already reversed' }, { status: 409 });
  }

  // 3. Set reversed_at and reversed_reason on the conversion_event
  const reversedAt = new Date().toISOString();

  const { error: updateCeErr } = await supabase
    .schema('mih')
    .from('conversion_events')
    .update({
      reversed_at: reversedAt,
      reversed_reason: body.reason,
    })
    .eq('org_id', orgId)
    .eq('id', id);

  if (updateCeErr) {
    return NextResponse.json({ error: 'Failed to reverse conversion event' }, { status: 500 });
  }

  // 4. Find all non-superseded attribution_results for this conversion_event
  const { data: activeResults, error: resultsErr } = await supabase
    .schema('mih')
    .from('attribution_results')
    .select('id, model_id, org_id, cluster_id')
    .eq('org_id', orgId)
    .eq('conversion_event_id', id)
    .is('superseded_by_id', null);

  if (resultsErr) {
    return NextResponse.json({ error: 'Failed to fetch attribution results' }, { status: 500 });
  }

  const results = (activeResults ?? []) as Array<Record<string, unknown>>;

  // 5. For each active result: insert reversal tombstone, then mark original superseded
  let resultsSuperseded = 0;

  for (const result of results) {
    const { data: tombstone, error: tombstoneErr } = await supabase
      .schema('mih')
      .from('attribution_results')
      .insert({
        org_id: orgId,
        conversion_event_id: id,
        model_id: result.model_id,
        cluster_id: result.cluster_id ?? null,
        winning_source_id: null,
        winning_raw_lead_id: null,
        winning_touch_at: null,
        weight: 0,
        reason: 'conversion_reversed',
        rule_applied: 'conversion_reversed',
        computation_inputs: {
          reversal_reason: body.reason,
          original_result_id: result.id,
        },
      })
      .select('id')
      .single();

    if (tombstoneErr || !tombstone) continue;

    const tombstoneId = (tombstone as Record<string, string>).id;

    await supabase
      .schema('mih')
      .from('attribution_results')
      .update({ superseded_by_id: tombstoneId })
      .eq('id', result.id as string);

    resultsSuperseded++;
  }

  // 6. Return summary
  return NextResponse.json({
    conversion_event_id: id,
    reversed_at: reversedAt,
    results_superseded: resultsSuperseded,
  });
}
