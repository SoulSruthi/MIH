import type { Metadata } from 'next';
import { RoiDashboard } from '@/components/roi/RoiDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'ROI Dashboard — MIH',
};

export default function RoiPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">ROI Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">
          Cost per booking, funnel analysis, and spend vs bookings.
        </p>
      </div>
      <RoiDashboard />
    </div>
  );
}
