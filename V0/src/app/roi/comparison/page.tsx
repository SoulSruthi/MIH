import type { Metadata } from 'next';
import { ComparisonModelView } from '@/components/roi/ComparisonModelView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Attribution Model Comparison — MIH',
};

export default function AttributionComparisonPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Attribution Model Comparison</h1>
        <p className="mt-1 text-sm text-slate-500">
          First-touch, last-touch, and time-decay side-by-side. Decision-support only — first-touch is the operational model.
        </p>
      </div>
      <ComparisonModelView />
    </div>
  );
}
