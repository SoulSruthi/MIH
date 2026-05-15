import type { Metadata } from 'next';
import { RoiDashboard } from '@/components/dashboard/RoiDashboard';

export const metadata: Metadata = {
  title: 'ROI Dashboard — MIH',
};

export default function RoiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ROI Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Attribution, spend efficiency, and funnel performance across all lead sources.
        </p>
      </div>
      <RoiDashboard />
    </div>
  );
}
