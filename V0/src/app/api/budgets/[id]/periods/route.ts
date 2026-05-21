import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

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
    .select('id')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .maybeSingle();

  if (budgetError) return NextResponse.json({ error: budgetError.message }, { status: 500 });
  if (!budget) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  let query = supabase
    .schema('mih')
    .from('budget_periods')
    .select('*')
    .eq('budget_id', params.id)
    .eq('org_id', orgId)
    .order('start_date', { ascending: true });

  if (period_type) query = query.eq('period_type', period_type);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ periods: data ?? [] });
}
