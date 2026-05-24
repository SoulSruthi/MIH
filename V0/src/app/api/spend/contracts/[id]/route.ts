import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();
  const [contractRes, entriesRes] = await Promise.all([
    supabase.schema('mih').from('spend_contracts').select('*').eq('id', params.id).eq('org_id', orgId).single(),
    supabase.schema('mih').from('spend_entries').select('*').eq('contract_id', params.id).eq('org_id', orgId).order('period_start', { ascending: true }),
  ]);

  if (contractRes.error || !contractRes.data) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  return NextResponse.json({ contract: contractRes.data, entries: entriesRes.data ?? [] });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Verify contract exists and belongs to this org
  const { data: contract, error: fetchErr } = await supabase
    .schema('mih')
    .from('spend_contracts')
    .select('id, is_active')
    .eq('id', params.id)
    .eq('org_id', orgId)
    .single();

  if (fetchErr || !contract) {
    return NextResponse.json({ error: 'Contract not found' }, { status: 404 });
  }

  const now = new Date().toISOString();
  const today = now.split('T')[0] as string;

  // Terminate contract
  const { data: updated, error: updateErr } = await supabase
    .schema('mih')
    .from('spend_contracts')
    .update({ is_active: false, terminated_at: now, updated_at: now })
    .eq('id', params.id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (updateErr) return NextResponse.json({ error: updateErr.message }, { status: 500 });

  // Delete future amortized spend entries (period_start > today)
  const { count: deletedCount } = await supabase
    .schema('mih')
    .from('spend_entries')
    .delete({ count: 'exact' })
    .eq('contract_id', params.id)
    .eq('org_id', orgId)
    .eq('entry_kind', 'recurring_amortized')
    .gt('period_start', today);

  return NextResponse.json({
    contract: updated,
    future_entries_deleted: deletedCount ?? 0,
  });
}
