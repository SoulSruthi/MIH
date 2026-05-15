import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { detectAllAnomalies } from '@/modules/anomalies/detectors';
import type { AnomalyAlert } from '@/modules/anomalies/types';

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 3600_000).toISOString().split('T')[0];
  const dayAgo = new Date(now.getTime() - 24 * 3600_000).toISOString();
  const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 3600_000).toISOString().split('T')[0];

  // Get active sources (cast: Supabase types not generated for this project)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: sourcesRaw } = await (supabase as any)
    .from('sources')
    .select('id, name')
    .eq('organization_id', orgId);

  const sources = (sourcesRaw ?? []) as Array<{ id: string; name: string }>;

  const alerts: AnomalyAlert[] = [];

  for (const source of sources) {
    // This week CPL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: thisWeekRollups } = await (supabase as any)
      .from('attribution_rollups')
      .select('cpl_paise')
      .eq('organization_id', orgId)
      .eq('source_id', source.id)
      .gte('rollup_date', weekAgo)
      .not('cpl_paise', 'is', null);

    const twrTyped = (thisWeekRollups ?? []) as Array<{ cpl_paise: number | null }>;
    const thisWeekCpl = twrTyped.length > 0
      ? Math.round(twrTyped.reduce((s, r) => s + (r.cpl_paise ?? 0), 0) / twrTyped.length)
      : null;

    // Last week CPL
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: lastWeekRollups } = await (supabase as any)
      .from('attribution_rollups')
      .select('cpl_paise')
      .eq('organization_id', orgId)
      .eq('source_id', source.id)
      .gte('rollup_date', twoWeeksAgo)
      .lt('rollup_date', weekAgo)
      .not('cpl_paise', 'is', null);

    const lwrTyped = (lastWeekRollups ?? []) as Array<{ cpl_paise: number | null }>;
    const lastWeekCpl = lwrTyped.length > 0
      ? Math.round(lwrTyped.reduce((s, r) => s + (r.cpl_paise ?? 0), 0) / lwrTyped.length)
      : null;

    // Health score
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: connectorConfig } = await (supabase as any)
      .from('org_connector_configs')
      .select('health_score')
      .eq('organization_id', orgId)
      .maybeSingle();

    const configTyped = connectorConfig as { health_score: number | null } | null;

    // Leads last 24h
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: leadsLast24h } = await (supabase as any)
      .from('raw_leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('source_id', source.id)
      .gte('ingested_at', dayAgo);

    // Was active last 7 days?
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { count: leadsLast7d } = await (supabase as any)
      .from('raw_leads')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', orgId)
      .eq('source_id', source.id)
      .gte('ingested_at', new Date(now.getTime() - 7 * 24 * 3600_000).toISOString());

    const sourceAlerts = detectAllAnomalies([{
      sourceId: source.id,
      sourceName: source.name,
      thisWeekCplPaise: thisWeekCpl,
      lastWeekCplPaise: lastWeekCpl,
      healthScore: configTyped?.health_score ?? null,
      leadsLast24h: (leadsLast24h as number | null) ?? 0,
      wasActiveLast7d: ((leadsLast7d as number | null) ?? 0) > 0,
    }], orgId);

    alerts.push(...sourceAlerts);
  }

  return NextResponse.json({ alerts, checked_at: now.toISOString() });
}
