import type { Metadata } from 'next';
import { VarianceAlerts } from '@/components/roi/VarianceAlerts';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Variance Alerts — MIH',
};

export default function AlertsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Variance Alerts</h1>
        <p className="mt-1 text-sm text-slate-500">
          Spend overruns, booking shortfalls, and CPB spikes.
        </p>
      </div>
      <VarianceAlerts />
    </div>
  );
}
