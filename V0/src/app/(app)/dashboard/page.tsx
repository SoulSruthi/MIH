import { headers } from 'next/headers';
import { getSupabaseAdmin } from '@/lib/supabase-admin';
import {
  getLeadVolumeSummary,
  getHandoffStatusSummary,
  getSourceBreakdown,
  getRecentLeads,
  type PeriodFilter,
} from '@/modules/analytics';
import { LeadVolumeCard } from './_components/lead-volume-card';
import { HandoffStatusCard } from './_components/handoff-status-card';
import { LeadsBySource } from './_components/leads-by-source';
import { RecentLeadsTable } from './_components/recent-leads-table';

const PERIOD_LABELS: Record<PeriodFilter, string> = {
  today: 'Today',
  '7d': '7 days',
  '30d': '30 days',
};

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const sp = await searchParams;
  const period = (['today', '7d', '30d'].includes(sp.period ?? '') ? sp.period : '7d') as PeriodFilter;

  // Org ID from header (set by middleware in production)
  const hdrs = await headers();
  const orgId = hdrs.get('x-org-id') ?? (sp.org_id ?? '');

  if (!orgId) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">No organization context. Set x-org-id header or ?org_id= param.</p>
      </main>
    );
  }

  const supabase = getSupabaseAdmin();

  const [volumeData, handoffData, sourceData, recentData] = await Promise.all([
    getLeadVolumeSummary(supabase, orgId, period),
    getHandoffStatusSummary(supabase, orgId, period),
    getSourceBreakdown(supabase, orgId, period),
    getRecentLeads(supabase, orgId, 50),
  ]);

  return (
    <main className="min-h-screen bg-background p-6">
      <div className="mx-auto max-w-7xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Lead Intelligence Dashboard</h1>
            <p className="text-sm text-muted-foreground">Real-time lead & dedup metrics</p>
          </div>

          {/* Period picker */}
          <div className="flex gap-1 rounded-lg border bg-card p-1">
            {(Object.keys(PERIOD_LABELS) as PeriodFilter[]).map((p) => (
              <a
                key={p}
                href={`?period=${p}&org_id=${orgId}`}
                className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                  period === p
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {PERIOD_LABELS[p]}
              </a>
            ))}
          </div>
        </div>

        {/* Widget 1: Lead Volume */}
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Lead Volume — {PERIOD_LABELS[period]}
          </h2>
          <LeadVolumeCard data={volumeData} period={PERIOD_LABELS[period]} />
        </section>

        {/* Widget 2: CRM Handoff Status */}
        <section>
          <HandoffStatusCard data={handoffData} />
        </section>

        {/* Widget 3: Leads by Source */}
        <section>
          <LeadsBySource rows={sourceData} />
        </section>

        {/* Widget 4: Recent 50 Leads */}
        <section>
          <RecentLeadsTable leads={recentData} maskPhones />
        </section>
      </div>
    </main>
  );
}
