'use client';

import { StatsCards } from '@/components/leads/StatsCards';
import { SourceBreakdownTable } from '@/components/leads/SourceBreakdownTable';
import { UniqueLeadsTable } from '@/components/leads/UniqueLeadsTable';
import { DedupAuditTable } from '@/components/leads/DedupAuditTable';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { LeadStatsResponse } from '@/app/leads/page';

interface LeadsDashboardProps {
  initialStats: LeadStatsResponse | null;
}

export function LeadsDashboard({ initialStats }: LeadsDashboardProps) {
  const totals = initialStats?.totals ?? {
    raw_leads: 0,
    unique_leads: 0,
    duplicates: 0,
    pending: 0,
    dedup_rate_pct: null,
  };

  const sources = initialStats?.sources ?? [];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <StatsCards totals={totals} />

      {/* Source Breakdown */}
      <SourceBreakdownTable sources={sources} />

      {/* Tabs: Unique Leads | Dedup Audit */}
      <Tabs defaultValue="unique-leads">
        <TabsList className="mb-1">
          <TabsTrigger value="unique-leads">Unique Leads</TabsTrigger>
          <TabsTrigger value="dedup-audit">Dedup Audit</TabsTrigger>
        </TabsList>

        <TabsContent value="unique-leads">
          <UniqueLeadsTable />
        </TabsContent>

        <TabsContent value="dedup-audit">
          <DedupAuditTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
