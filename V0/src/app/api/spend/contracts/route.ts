import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('spend_contracts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contracts: data ?? [] });
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

  const required = ['vendor_name', 'total_amount_paise', 'amortization', 'contract_start', 'contract_end'];
  for (const field of required) {
    if (!body[field]) return NextResponse.json({ error: `${field} is required` }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('spend_contracts')
    .insert({
      org_id: orgId,
      project_id: body.project_id ?? null,
      source_id: body.source_id ?? null,
      vendor_name: body.vendor_name,
      total_amount_paise: body.total_amount_paise,
      amortization: body.amortization,
      contract_start: body.contract_start,
      contract_end: body.contract_end,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ contract: data }, { status: 201 });
}
