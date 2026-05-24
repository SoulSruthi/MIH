import { getSupabaseAdmin } from '@/lib/supabase-admin';
import type { VarianceAlert, AlertType, AlertSeverity } from './types';

export function determineSeverity(variancePct: number): AlertSeverity {
  const abs = Math.abs(variancePct);
  if (abs >= 30) return 'critical';
  if (abs >= 15) return 'warning';
  return 'info';
}

export async function createAlert(params: {
  orgId: string;
  alertType: AlertType;
  severity: AlertSeverity;
  projectId?: string;
  sourceId?: string;
  periodStart: string;
  periodEnd: string;
  context?: Record<string, unknown>;
}): Promise<VarianceAlert> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('variance_alerts')
    .insert({
      org_id: params.orgId,
      alert_type: params.alertType,
      severity: params.severity,
      project_id: params.projectId ?? null,
      source_id: params.sourceId ?? null,
      period_start: params.periodStart,
      period_end: params.periodEnd,
      context: params.context ?? {},
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as VarianceAlert;
}

export async function checkVariance(
  orgId: string,
  budgetId: string,
  periodStart: string,
  periodEnd: string,
): Promise<VarianceAlert[]> {
  const supabase = getSupabaseAdmin();

  const { data: periods } = await supabase
    .schema('mih')
    .from('budget_periods')
    .select('id, planned_paise, actual_paise, budget_id')
    .eq('org_id', orgId)
    .eq('budget_id', budgetId)
    .gte('start_date', periodStart)
    .lte('end_date', periodEnd);

  if (!periods || periods.length === 0) return [];

  const alerts: VarianceAlert[] = [];

  for (const period of periods) {
    const planned = period.planned_paise ?? 0;
    const actual = period.actual_paise ?? 0;

    if (planned === 0) continue;

    const variancePct = ((actual - planned) / planned) * 100;

    if (Math.abs(variancePct) >= 15) {
      const alertType: AlertType = variancePct > 0 ? 'spend_overrun' : 'booking_shortfall';
      const severity = determineSeverity(variancePct);

      const alert = await createAlert({
        orgId,
        alertType,
        severity,
        periodStart,
        periodEnd,
        context: {
          budget_id: budgetId,
          period_id: period.id,
          planned_paise: planned,
          actual_paise: actual,
          variance_pct: variancePct,
        },
      });
      alerts.push(alert);
    }
  }

  return alerts;
}

export async function resolveAlert(id: string, orgId: string): Promise<VarianceAlert> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .schema('mih')
    .from('variance_alerts')
    .update({ resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('org_id', orgId)
    .select()
    .single();

  if (error) throw new Error(error.message);
  return data as VarianceAlert;
}

export async function listAlerts(
  orgId: string,
  params: {
    resolved?: boolean;
    severity?: string;
    projectId?: string;
  } = {},
): Promise<VarianceAlert[]> {
  const supabase = getSupabaseAdmin();
  let query = supabase
    .schema('mih')
    .from('variance_alerts')
    .select('*')
    .eq('org_id', orgId)
    .order('created_at', { ascending: false });

  if (params.resolved === false) query = query.is('resolved_at', null);
  if (params.resolved === true) query = query.not('resolved_at', 'is', null);
  if (params.severity) query = query.eq('severity', params.severity);
  if (params.projectId) query = query.eq('project_id', params.projectId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as VarianceAlert[];
}
