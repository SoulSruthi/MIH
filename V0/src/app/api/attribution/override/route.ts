import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

interface OverrideBody {
  conversion_event_id: string;
  winning_source_id: string;
  winning_raw_lead_id?: string;
  override_reason: string;
  notes?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: OverrideBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // 1. Validate required fields
  if (!body.conversion_event_id) {
    return NextResponse.json({ error: 'conversion_event_id is required' }, { status: 400 });
  }
  if (!body.winning_source_id) {
    return NextResponse.json({ error: 'winning_source_id is required' }, { status: 400 });
  }
  if (!body.override_reason) {
    return NextResponse.json({ error: 'override_reason is required' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // 3. Verify manual_override_allowed in attribution_config (default true if no row)
  const { data: configRow } = await supabase
    .schema('mih')
    .from('attribution_config')
    .select('manual_override_allowed')
    .eq('org_id', orgId)
    .single();

  const manualOverrideAllowed =
    configRow === null
      ? true
      : ((configRow as Record<string, unknown>).manual_override_allowed ?? true);

  if (!manualOverrideAllowed) {
    return NextResponse.json(
      { error: 'Manual overrides are disabled for this organization' },
      { status: 403 },
    );
  }

  // 4. Verify conversion_event exists and belongs to this org
  const { data: conversionEvent, error: ceError } = await supabase
    .schema('mih')
    .from('conversion_events')
    .select('id, cluster_id')
    .eq('org_id', orgId)
    .eq('id', body.conversion_event_id)
    .single();

  if (ceError || !conversionEvent) {
    return NextResponse.json({ error: 'Conversion event not found' }, { status: 404 });
  }

  const ce = conversionEvent as Record<string, unknown>;

  // 5. Get or create the first_touch_v1 operational model
  const { data: modelRow } = await supabase
    .schema('mih')
    .from('attribution_models')
    .select('id')
    .eq('org_id', orgId)
    .eq('model_code', 'first_touch_v1')
    .eq('is_operational', true)
    .single();

  let modelId: string;
  if (modelRow) {
    modelId = (modelRow as Record<string, string>).id;
  } else {
    const { data: created, error: createErr } = await supabase
      .schema('mih')
      .from('attribution_models')
      .insert({
        org_id: orgId,
        model_code: 'first_touch_v1',
        display_name: 'First Touch',
        description: 'Credits the first touchpoint within the conversion window.',
        is_operational: true,
        is_comparison: false,
      })
      .select('id')
      .single();

    if (createErr || !created) {
      return NextResponse.json({ error: 'Failed to get or create attribution model' }, { status: 500 });
    }
    modelId = (created as Record<string, string>).id;
  }

  // 6. Find any existing non-superseded attribution_result for this conversion_event + model
  const { data: existingResult } = await supabase
    .schema('mih')
    .from('attribution_results')
    .select('id')
    .eq('org_id', orgId)
    .eq('conversion_event_id', body.conversion_event_id)
    .eq('model_id', modelId)
    .is('superseded_by_id', null)
    .single();

  const priorResultId = existingResult
    ? (existingResult as Record<string, string>).id
    : null;

  // 7. Insert new attribution_result row
  const { data: newResult, error: insertErr } = await supabase
    .schema('mih')
    .from('attribution_results')
    .insert({
      org_id: orgId,
      conversion_event_id: body.conversion_event_id,
      model_id: modelId,
      cluster_id: ce.cluster_id ?? null,
      winning_source_id: body.winning_source_id,
      winning_raw_lead_id: body.winning_raw_lead_id ?? null,
      winning_touch_at: null,
      weight: 1.0,
      reason: 'manual_override',
      rule_applied: 'manual_override',
      computation_inputs: {
        override_reason: body.override_reason,
        notes: body.notes ?? null,
        overridden_by_result_id: priorResultId,
      },
    })
    .select()
    .single();

  if (insertErr || !newResult) {
    return NextResponse.json({ error: 'Failed to insert attribution result' }, { status: 500 });
  }

  const newResultId = (newResult as Record<string, unknown>).id as string;

  // 8. Mark prior result superseded_by_id = newResultId
  if (priorResultId) {
    await supabase
      .schema('mih')
      .from('attribution_results')
      .update({ superseded_by_id: newResultId })
      .eq('id', priorResultId);
  }

  // 9. Return result
  return NextResponse.json({
    attribution_result: newResult,
    superseded_id: priorResultId,
  });
}
