import { NextRequest, NextResponse } from 'next/server';
import { approveAccrual } from '@/modules/channel-partners/service';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; cid: string } },
): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  try {
    if (body.action === 'approve') {
      const accrual = await approveAccrual(
        params.cid,
        orgId,
        (body.approved_by as string) ?? 'system',
      );
      return NextResponse.json({ commission: accrual });
    }

    const supabase = getSupabaseAdmin();
    const allowedFields = ['state', 'payout_reference'];
    const updates: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .schema('mih')
      .from('cp_commission_accruals')
      .update(updates)
      .eq('id', params.cid)
      .eq('org_id', orgId)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ commission: data });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
