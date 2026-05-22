import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { computeVariance } from '@/modules/budget/variance';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const period_type = searchParams.get('period_type');

  // Verify budget belongs to org
  const { data: budget, error: budgetError } = await supabase
    .schema('mih')
    .from('budgets')
    .select('id, total_paise, fy_year')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });
  if (!budget) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let query = supabase
    .schema('mih')
    .from('budget_periods')
    .select('id, period_type, period_label, start_date, end_date, planned_paise, actual_paise')
    .eq('budget_id', params.id)
    .eq('org_id', orgId)
    .order('start_date', { ascending: true });

  if (period_type) query = query.eq('period_type', period_type);

  const { data: periods, error: periodsError } = await query;
  if (periodsError) return NextResponse.json({ error: periodsError.message }, { status: 500 });

  const variance = computeVariance(
    (periods ?? []).map((p) => ({
      period_id: p.id,
      period_type: p.period_type,
      period_label: p.period_label,
      start_date: p.start_date,
      end_date: p.end_date,
      planned_paise: p.planned_paise,
      actual_paise: p.actual_paise,
    })),
  );

  const totalPlanned = variance.reduce((s, p) => s + p.planned_paise, 0);
  const totalActual = variance.reduce((s, p) => s + p.actual_paise, 0);

  return NextResponse.json({
    budget_id: params.id,
    fy_year: budget.fy_year,
    total_planned_paise: budget.total_paise,
    total_actual_paise: totalActual,
    total_variance_paise: totalActual - budget.total_paise,
    periods: variance,
    period_type_filter: period_type ?? null,
  });
}
