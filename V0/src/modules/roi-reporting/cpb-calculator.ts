import type { CPBMetrics } from './types';

export function calculateCPB(totalSpend: number, totalBookings: number): number {
  if (totalBookings <= 0) return 0;
  return Math.round(totalSpend / totalBookings);
}

export function calculateCPL(totalSpend: number, totalLeads: number): number {
  if (totalLeads <= 0) return 0;
  return Math.round(totalSpend / totalLeads);
}

export function calculateCPQL(totalSpend: number, totalQualifiedLeads: number): number {
  if (totalQualifiedLeads <= 0) return 0;
  return Math.round(totalSpend / totalQualifiedLeads);
}

export function computeCPBMetrics(params: {
  totalSpend: number;
  totalBookings: number;
  totalLeads: number;
  totalQualifiedLeads: number;
  periodStart: string;
  periodEnd: string;
}): CPBMetrics {
  return {
    total_spend: params.totalSpend,
    total_bookings: params.totalBookings,
    total_leads: params.totalLeads,
    total_qualified_leads: params.totalQualifiedLeads,
    cpb: calculateCPB(params.totalSpend, params.totalBookings),
    cpl: calculateCPL(params.totalSpend, params.totalLeads),
    cpql: calculateCPQL(params.totalSpend, params.totalQualifiedLeads),
    period_start: params.periodStart,
    period_end: params.periodEnd,
  };
}
