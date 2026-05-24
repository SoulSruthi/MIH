import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const { searchParams } = new URL(req.url);
  const state = searchParams.get('state');
  const severity = searchParams.get('severity');
  const itemType = searchParams.get('item_type');
  const page = parseInt(searchParams.get('page') ?? '1');
  const perPage = Math.min(parseInt(searchParams.get('per_page') ?? '20'), 100);
  const offset = (page - 1) * perPage;

  const supabase = getSupabaseAdmin();

  let query = supabase
    .schema('mih')
    .from('reconciliation_items')
    .select('*', { count: 'exact' })
    .eq('org_id', orgId)
    .order('created_at', { ascending: false })
    .range(offset, offset + perPage - 1);

  if (state) query = query.eq('state', state);
  if (severity) query = query.eq('severity', severity);
  if (itemType) query = query.eq('item_type', itemType);

  const { data, error, count } = await query;

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ items: data ?? [], total: count ?? 0, page, per_page: perPage });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .schema('mih')
    .from('reconciliation_items')
    .insert({
      org_id: orgId,
      item_type: body.item_type,
      state: 'open',
      severity: body.severity ?? 'normal',
      monetary_impact: body.monetary_impact ?? null,
      context: body.context ?? {},
      assigned_to: body.assigned_to ?? null,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ item: data }, { status: 201 });
}
