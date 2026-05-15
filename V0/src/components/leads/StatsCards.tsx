import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, UserCheck, Copy, TrendingDown } from 'lucide-react';
import type { LeadStatsResponse } from '@/app/leads/page';

interface StatsCardsProps {
  totals: LeadStatsResponse['totals'];
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function StatsCards({ totals }: StatsCardsProps) {
  const cards = [
    {
      title: 'Total Leads',
      value: formatNumber(totals.raw_leads),
      description: 'All raw inbound leads',
      icon: Users,
      iconClass: 'text-slate-600',
      bgClass: 'bg-slate-100',
    },
    {
      title: 'Unique Leads',
      value: formatNumber(totals.unique_leads),
      description: 'Distinct individuals identified',
      icon: UserCheck,
      iconClass: 'text-emerald-600',
      bgClass: 'bg-emerald-50',
    },
    {
      title: 'Duplicates Removed',
      value: formatNumber(totals.duplicates),
      description: 'Duplicate submissions merged',
      icon: Copy,
      iconClass: 'text-amber-600',
      bgClass: 'bg-amber-50',
    },
    {
      title: 'Dedup Rate',
      value: totals.dedup_rate_pct != null ? `${totals.dedup_rate_pct}%` : '—',
      description: 'Percentage of leads deduplicated',
      icon: TrendingDown,
      iconClass: 'text-blue-600',
      bgClass: 'bg-blue-50',
    },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <Card key={card.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-slate-600">
                {card.title}
              </CardTitle>
              <div className={`rounded-md p-2 ${card.bgClass}`}>
                <Icon className={`h-4 w-4 ${card.iconClass}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-slate-900">{card.value}</div>
              <p className="mt-1 text-xs text-slate-500">{card.description}</p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
