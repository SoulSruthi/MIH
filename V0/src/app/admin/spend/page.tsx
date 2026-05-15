import { SpendTracker } from '@/components/admin/SpendTracker';

export default function SpendPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Spend Tracking</h1>
        <p className="text-slate-500 mt-1">Record and review marketing spend per source to calculate ROI.</p>
      </div>
      <SpendTracker />
    </div>
  );
}
