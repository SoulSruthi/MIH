import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id header required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // Parallel fetch: all open items for stats
  const [openRes, resolvedTodayRes, slaBreachedRes] = await Promise.all([
    supabase.schema('mih').from('reconciliation_items').select('id, item_type, severity, created_at, sla_deadline_at').eq('org_id', orgId).not('state', 'in', '(resolved,closed,expired)'),
    supabase.schema('mih').from('reconciliation_items').select('id').eq('org_id', orgId).eq('state', 'resolved').gte('updated_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
    supabase.schema('mih').from('reconciliation_items').select('id, severity').eq('org_id', orgId).not('state', 'in', '(resolved,closed,expired)').lt('sla_deadline_at', new Date().toISOString()),
  ]);

  const openItems = (openRes.data ?? []) as Array<{ id: string; item_type: string; severity: string; created_at: string; sla_deadline_at: string }>;
  const now = new Date();

  // Ageing histogram: bucket by days since created_at
  const ageing = { '0-1d': 0, '1-3d': 0, '3-7d': 0, '7d+': 0 };
  for (const item of openItems) {
    const days = (now.getTime() - new Date(item.created_at).getTime()) / (1000 * 60 * 60 * 24);
    if (days < 1) ageing['0-1d']++;
    else if (days < 3) ageing['1-3d']++;
    else if (days < 7) ageing['3-7d']++;
    else ageing['7d+']++;
  }

  // By item_type breakdown
  const byType: Record<string, number> = {};
  for (const item of openItems) {
    byType[item.item_type] = (byType[item.item_type] ?? 0) + 1;
  }

  // SLA compliance % (resolved in time / total resolved — approximate using open breach rate)
  const totalOpen = openItems.length;
  const breached = (slaBreachedRes.data ?? []).length;
  const slaCompliancePct = totalOpen > 0 ? Math.round(((totalOpen - breached) / totalOpen) * 100) : 100;

  return NextResponse.json({
    open_total: totalOpen,
    resolved_today: (resolvedTodayRes.data ?? []).length,
    sla_breached: breached,
    sla_compliance_pct: slaCompliancePct,
    ageing_histogram: ageing,
    by_type: byType,
  });
}
