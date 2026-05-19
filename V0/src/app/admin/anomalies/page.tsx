import { AnomalyAlerts } from '@/components/admin/AnomalyAlerts';

export const dynamic = 'force-dynamic';

export default function AnomaliesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Anomaly Alerts</h1>
        <p className="text-slate-500 mt-1">Real-time detection of CPL spikes, connector health drops, and silent sources.</p>
      </div>
      <AnomalyAlerts />
    </div>
  );
}
