import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data: sub } = await supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('organization_id', orgId)
    .maybeSingle();

  const { data: invoices } = await supabase
    .from('billing_invoices')
    .select(
      'id, stripe_invoice_id, amount_paise, currency, status, invoice_url, period_start, created_at',
    )
    .eq('organization_id', orgId)
    .order('created_at', { ascending: false })
    .limit(10);

  // Usage stats
  const { count: seatCount } = await supabase
    .from('org_memberships')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId);

  const { count: handoffCount } = await supabase
    .from('unique_leads')
    .select('id', { count: 'exact', head: true })
    .eq('organization_id', orgId)
    .eq('crm_handoff_status', 'succeeded');

  return NextResponse.json({
    subscription: sub ?? null,
    invoices: invoices ?? [],
    usage: {
      seats: seatCount ?? 0,
      handoff_leads: handoffCount ?? 0,
      free_tier_leads_remaining: Math.max(0, 200 - (handoffCount ?? 0)),
    },
  });
}
