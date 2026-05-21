import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { decomposeBudget } from '@/modules/budget/decompose';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const project_id = searchParams.get('project_id');
  const fy_year = searchParams.get('fy_year');

  let query = supabase
    .schema('mih')
    .from('budgets')
    .select('*')
    .eq('org_id', orgId)
    .order('fy_year', { ascending: false });

  if (project_id) query = query.eq('project_id', project_id);
  if (fy_year) query = query.eq('fy_year', parseInt(fy_year));

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ budgets: data ?? [] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: { project_id?: string; fy_year?: number; total_paise?: number; notes?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.project_id || !body.fy_year || body.total_paise == null) {
    return NextResponse.json(
      { error: 'project_id, fy_year, and total_paise are required' },
      { status: 400 },
    );
  }
  if (body.total_paise < 0) {
    return NextResponse.json({ error: 'total_paise must be >= 0' }, { status: 400 });
  }

  let supabase: ReturnType<typeof getSupabaseAdmin>;
  try {
    supabase = getSupabaseAdmin();
  } catch {
    return NextResponse.json({ error: 'internal_server_error' }, { status: 500 });
  }

  const { data: budget, error: budgetError } = await supabase
    .schema('mih')
    .from('budgets')
    .insert({
      org_id: orgId,
      project_id: body.project_id,
      fy_year: body.fy_year,
      total_paise: body.total_paise,
      notes: body.notes ?? null,
    })
    .select()
    .single();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });

  // Auto-decompose into all period types
  const decomposed = decomposeBudget(body.fy_year, body.total_paise);
  const allPeriods = [
    ...decomposed.annual,
    ...decomposed.quarterly,
    ...decomposed.monthly,
    ...decomposed.weekly,
  ].map((p) => ({
    org_id: orgId,
    budget_id: budget.id,
    ...p,
  }));

  const { error: periodsError } = await supabase
    .schema('mih')
    .from('budget_periods')
    .insert(allPeriods);

  if (periodsError) return NextResponse.json({ error: periodsError.message }, { status: 500 });

  return NextResponse.json({ budget }, { status: 201 });
}
