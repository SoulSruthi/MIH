import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { upsertSpend } from '@/modules/spend/index';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { searchParams } = new URL(req.url);
  const sourceId = searchParams.get('source_id');
  const start = searchParams.get('start');
  const end = searchParams.get('end');

  let query = supabase
    .from('spend_daily')
    .select('id, source_id, spend_date, amount_paise, currency, campaign_id, campaign_name, data_source, created_at, sources!source_id(id, name, source_type)')
    .eq('organization_id', orgId)
    .is('superseded_by', null)
    .order('spend_date', { ascending: false });

  if (sourceId) query = query.eq('source_id', sourceId);
  if (start) query = query.gte('spend_date', start);
  if (end) query = query.lte('spend_date', end);

  const { data, error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ spend: data ?? [] });
}

type PostSpendBody = {
  source_id: string;
  spend_date: string;
  amount_inr: number;
  campaign_id?: string;
  campaign_name?: string;
  notes?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  let body: PostSpendBody;
  try {
    body = (await req.json()) as PostSpendBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { source_id, spend_date, amount_inr, campaign_id, campaign_name, notes } = body;

  if (!source_id) return NextResponse.json({ error: 'source_id required' }, { status: 400 });
  if (!spend_date) return NextResponse.json({ error: 'spend_date required' }, { status: 400 });
  if (typeof amount_inr !== 'number' || amount_inr < 0) {
    return NextResponse.json({ error: 'amount_inr must be a non-negative number' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const rawPayload: Record<string, unknown> = { notes: notes ?? null };

  try {
    const result = await upsertSpend(supabase, {
      organizationId: orgId,
      sourceId: source_id,
      spendDate: spend_date,
      amountPaise: Math.round(amount_inr * 100),
      campaignId: campaign_id,
      campaignName: campaign_name,
      dataSource: 'manual',
      rawPayload,
    });
    return NextResponse.json({ id: result.id }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
