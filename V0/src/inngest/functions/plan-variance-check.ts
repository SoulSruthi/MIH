import { inngest } from '../client';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import { createAlert } from '@/modules/roi-reporting/variance-detector';

function getCurrentMonthBounds() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0] as string;
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0] as string;
  return { start, end };
}

function daysElapsedInMonth(): { elapsed: number; total: number } {
  const now = new Date();
  const elapsed = now.getDate();
  const total = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { elapsed, total };
}

export const planVarianceCheckFunction = inngest.createFunction(
  {
    id: 'plan-variance-check',
    name: 'Nightly Plan-vs-Actual Variance Check',
    triggers: [{ cron: '30 18 * * *' }],
  },
  async ({ logger }) => {
    const supabase = getSupabaseAdmin();
    const { start: periodStart, end: periodEnd } = getCurrentMonthBounds();
    const { elapsed, total } = daysElapsedInMonth();
    const pacingFactor = elapsed / total;

    let checked = 0;
    let alertsCreated = 0;

    const { data: activeBudgets, error: budgetsError } = await supabase
      .schema('mih')
      .from('budgets')
      .select('id, org_id, total_marketing_budget')
      .eq('state', 'active');

    if (budgetsError) {
      logger.error('Failed to fetch active budgets', { error: budgetsError.message });
      return { checked: 0, alerts_created: 0 };
    }

    for (const budget of activeBudgets ?? []) {
      const orgId = budget.org_id as string;
      const budgetId = budget.id as string;

      const { data: allocations } = await supabase
        .schema('mih')
        .from('budget_allocations')
        .select('id, planned_paise, source_id, project_id, medium')
        .eq('org_id', orgId)
        .eq('budget_id', budgetId);

      if (!allocations || allocations.length === 0) continue;

      for (const alloc of allocations) {
        const planned = (alloc.planned_paise as number) ?? 0;
        if (planned === 0) continue;

        const { data: actuals } = await supabase
          .schema('mih')
          .from('budget_actuals')
          .select('spend_actual_paise, bookings_count_actual, bookings_value_actual')
          .eq('org_id', orgId)
          .eq('allocation_id', alloc.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const spendActual = (actuals?.spend_actual_paise as number) ?? 0;
        const bookingsActual = (actuals?.bookings_count_actual as number) ?? 0;

        checked++;

        // Spend overrun check: actual > 115% of planned
        const spendVariancePct = planned > 0 ? ((spendActual - planned) / planned) * 100 : 0;
        if (spendVariancePct > 15) {
          const existing = await supabase
            .schema('mih')
            .from('variance_alerts')
            .select('id')
            .eq('org_id', orgId)
            .eq('alert_type', 'spend_overrun')
            .is('resolved_at', null)
            .contains('context', { budget_id: budgetId, allocation_id: alloc.id })
            .maybeSingle();

          if (!existing.data) {
            await createAlert({
              orgId,
              alertType: 'spend_overrun',
              severity: spendVariancePct > 25 ? 'critical' : 'warning',
              projectId: (alloc.project_id as string) ?? undefined,
              sourceId: (alloc.source_id as string) ?? undefined,
              periodStart,
              periodEnd,
              context: {
                budget_id: budgetId,
                allocation_id: alloc.id,
                planned_paise: planned,
                actual_paise: spendActual,
                variance_pct: Math.round(spendVariancePct * 10) / 10,
              },
            });
            alertsCreated++;
          }
        }

        // Booking shortfall: paced target = planned_bookings * elapsed/total
        // Approximate: if spend per booking is expected at some rate, bookings should pace linearly
        // Use a simpler heuristic: if 0 bookings AND >50% of month elapsed → shortfall
        if (pacingFactor > 0.5 && bookingsActual === 0 && spendActual > 0) {
          const existing = await supabase
            .schema('mih')
            .from('variance_alerts')
            .select('id')
            .eq('org_id', orgId)
            .eq('alert_type', 'booking_shortfall')
            .is('resolved_at', null)
            .contains('context', { budget_id: budgetId, allocation_id: alloc.id })
            .maybeSingle();

          if (!existing.data) {
            await createAlert({
              orgId,
              alertType: 'booking_shortfall',
              severity: 'warning',
              projectId: (alloc.project_id as string) ?? undefined,
              sourceId: (alloc.source_id as string) ?? undefined,
              periodStart,
              periodEnd,
              context: {
                budget_id: budgetId,
                allocation_id: alloc.id,
                pacing_factor: pacingFactor,
                bookings_actual: bookingsActual,
                spend_actual_paise: spendActual,
              },
            });
            alertsCreated++;
          }
        }
      }
    }

    logger.info('Plan variance check complete', { checked, alerts_created: alertsCreated });
    return { checked, alerts_created: alertsCreated };
  },
);
