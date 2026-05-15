import type { Metadata } from 'next';
import { LeadsDashboard } from '@/components/leads/LeadsDashboard';

export const metadata: Metadata = {
  title: 'Leads — MIH',
};

export type LeadStatsResponse = {
  totals: {
    raw_leads: number;
    unique_leads: number;
    duplicates: number;
    pending: number;
    dedup_rate_pct: number | null;
  };
  sources: Array<{
    source_id: string;
    source_name: string;
    source_type: string;
    total_leads: number;
    unique_count: number;
    duplicate_count: number;
    pending_count: number;
    dedup_rate_pct: number | null;
  }>;
};

async function fetchStats(): Promise<LeadStatsResponse | null> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000'}/api/leads/stats`,
      {
        headers: { 'x-org-id': 'demo-org-id' },
        cache: 'no-store',
      },
    );
    if (!res.ok) return null;
    return res.json() as Promise<LeadStatsResponse>;
  } catch {
    return null;
  }
}

export default async function LeadsPage() {
  const stats = await fetchStats();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Lead Intelligence</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track, deduplicate, and manage your real estate leads across all sources.
        </p>
      </div>
      <LeadsDashboard initialStats={stats} />
    </div>
  );
}
