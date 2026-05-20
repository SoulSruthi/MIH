import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

type SourceRef = {
  id: string;
  name: string;
  source_type: string;
};

export type SourceCostRow = {
  id: string;
  source_id: string;
  period_start: string;
  period_end: string;
  amount_paise: number;
  currency: string;
  notes: string | null;
  created_at: string;
  sources: SourceRef | null;
};

type AddCostBody = {
  source_id: string;
  period_start: string;
  period_end: string;
  amount_inr: number;
  notes?: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('source_costs')
    .select(
      'id, source_id, period_start, period_end, amount_paise, currency, notes, created_at, sources!source_id(id, name, source_type)',
    )
    .eq('organization_id', orgId)
    .order('period_start', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ costs: (data ?? []) as SourceCostRow[] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as AddCostBody;

  if (!body.source_id || !body.period_start || !body.period_end || body.amount_inr == null) {
    return NextResponse.json(
      { error: 'source_id, period_start, period_end, amount_inr required' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('source_costs')
    .upsert(
      {
        organization_id: orgId,
        source_id: body.source_id,
        period_start: body.period_start,
        period_end: body.period_end,
        amount_paise: Math.round(body.amount_inr * 100),
        currency: 'INR',
        notes: body.notes?.trim() ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'organization_id,source_id,period_start,period_end' },
    )
    .select('id, amount_paise')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, data });
}
