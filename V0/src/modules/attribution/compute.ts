import type { FunnelCounts, SpendData, AttributionRollup, AttributionModel } from './types';

export function computeMetrics(
  orgId: string,
  sourceId: string,
  rollupDate: string,
  model: AttributionModel,
  funnel: FunnelCounts,
  spend: SpendData,
): AttributionRollup {
  const { uniqueLeads, won, wonValuePaise, deals } = funnel;
  const { spendPaise } = spend;

  const cplPaise = uniqueLeads > 0 && spendPaise > 0
    ? Math.round(spendPaise / uniqueLeads)
    : null;

  const cpaPaise = deals > 0 && spendPaise > 0
    ? Math.round(spendPaise / deals)
    : null;

  const roasTimes100 = spendPaise > 0 && wonValuePaise > 0
    ? Math.round((wonValuePaise / spendPaise) * 100)
    : null;

  return {
    organizationId: orgId,
    sourceId,
    rollupDate,
    model,
    funnel,
    spend,
    cplPaise,
    cpaPaise,
    roasTimes100,
  };
}

export function aggregateFunnelCounts(
  events: Array<{ event_type: string; deal_value_paise?: number | null }>,
): FunnelCounts {
  return {
    uniqueLeads: 0, // populated separately from raw_leads count
    contacted: events.filter((e) => e.event_type === 'contacted').length,
    qualified: events.filter((e) => e.event_type === 'qualified').length,
    siteVisit: events.filter((e) => e.event_type === 'site_visit').length,
    deals: events.filter((e) => e.event_type === 'deal').length,
    won: events.filter((e) => e.event_type === 'won').length,
    wonValuePaise: events
      .filter((e) => e.event_type === 'won')
      .reduce((sum, e) => sum + (e.deal_value_paise ?? 0), 0),
  };
}
