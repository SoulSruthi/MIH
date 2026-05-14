import type { LeadVolumeSummary } from '@/modules/analytics';

type Props = {
  data: LeadVolumeSummary;
  period: string;
};

export function LeadVolumeCard({ data, period }: Props) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <StatCard label="Raw Leads" value={data.raw_leads} description={`Last ${period}`} />
      <StatCard label="Unique Leads" value={data.unique_leads} description="Real people" highlight />
      <StatCard label="Duplicates Saved" value={data.duplicates} description="Dedup prevented" />
      <StatCard
        label="Dedup Rate"
        value={`${data.dedup_rate_pct}%`}
        description="Of processed leads"
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
  highlight,
}: {
  label: string;
  value: string | number;
  description: string;
  highlight?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${highlight ? 'border-blue-500 bg-blue-50 dark:bg-blue-950/30' : 'bg-card'}`}>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-3xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-muted-foreground">{description}</p>
    </div>
  );
}
