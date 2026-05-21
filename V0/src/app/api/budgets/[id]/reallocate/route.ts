import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { validateReallocation } from '@/modules/budget/variance';

export const dynamic = 'force-dynamic';

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { from_period_id?: string; to_period_id?: string; amount_paise?: number; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.from_period_id || !body.to_period_id || body.amount_paise == null) {
    return NextResponse.json(
      { error: 'from_period_id, to_period_id, and amount_paise are required' },
      { status: 400 },
    );
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  // Verify budget belongs to org
  const { data: budget, error: budgetError } = await supabase
    .schema('mih')
    .from('budgets')
    .select('id')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });
  if (!budget) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  // Fetch both periods and verify they belong to this budget
  const { data: periods, error: periodsError } = await supabase
    .schema('mih')
    .from('budget_periods')
    .select('id, planned_paise, is_manual_override')
    .in('id', [body.from_period_id, body.to_period_id])
    .eq('budget_id', params.id)
    .eq('org_id', orgId);

  if (periodsError) return NextResponse.json({ error: periodsError.message }, { status: 500 });

  const fromPeriod = periods?.find((p) => p.id === body.from_period_id);
  const toPeriod = periods?.find((p) => p.id === body.to_period_id);

  if (!fromPeriod) return NextResponse.json({ error: 'from_period_id not found in this budget' }, { status: 404 });
  if (!toPeriod) return NextResponse.json({ error: 'to_period_id not found in this budget' }, { status: 404 });

  const validation = validateReallocation(fromPeriod.planned_paise, body.amount_paise);
  if (!validation.valid) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }

  // Update both periods
  const [fromUpdate, toUpdate] = await Promise.all([
    supabase
      .schema('mih')
      .from('budget_periods')
      .update({
        planned_paise: fromPeriod.planned_paise - body.amount_paise,
        is_manual_override: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.from_period_id)
      .eq('org_id', orgId),
    supabase
      .schema('mih')
      .from('budget_periods')
      .update({
        planned_paise: toPeriod.planned_paise + body.amount_paise,
        is_manual_override: true,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.to_period_id)
      .eq('org_id', orgId),
  ]);

  if (fromUpdate.error) return NextResponse.json({ error: fromUpdate.error.message }, { status: 500 });
  if (toUpdate.error) return NextResponse.json({ error: toUpdate.error.message }, { status: 500 });

  // Log the reallocation
  const { data: logEntry, error: logError } = await supabase
    .schema('mih')
    .from('budget_reallocation_log')
    .insert({
      org_id: orgId,
      budget_id: params.id,
      from_period_id: body.from_period_id,
      to_period_id: body.to_period_id,
      amount_paise: body.amount_paise,
      reason: body.reason ?? null,
    })
    .select()
    .single();

  if (logError) return NextResponse.json({ error: logError.message }, { status: 500 });

  return NextResponse.json({ reallocation: logEntry }, { status: 201 });
}
