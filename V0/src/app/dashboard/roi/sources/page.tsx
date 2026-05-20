import { RoiDashboard } from '@/components/dashboard/RoiDashboard';

export default function RoiSourcesPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">ROI by Source</h1>
      <RoiDashboard defaultPeriod={30} />
    </div>
  );
}
