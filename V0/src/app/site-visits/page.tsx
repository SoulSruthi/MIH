import type { Metadata } from 'next';
import { SiteVisitDashboard } from '@/components/site-visits/SiteVisitDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Site Visits — MIH',
};

export default function SiteVisitsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Site Visits</h1>
        <p className="mt-1 text-sm text-slate-500">
          Track scheduled visits, completions, and portal SLA targets.
        </p>
      </div>
      <SiteVisitDashboard />
    </div>
  );
}
