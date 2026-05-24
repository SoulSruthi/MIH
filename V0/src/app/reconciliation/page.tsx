import type { Metadata } from 'next';
import { ReconciliationQueue } from '@/components/reconciliation/ReconciliationQueue';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Reconciliation — MIH',
};

export default function ReconciliationPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Reconciliation Queue</h1>
        <p className="mt-1 text-sm text-slate-500">
          Disputed credits, manual overrides, and orphan spend investigations.
        </p>
      </div>
      <ReconciliationQueue />
    </div>
  );
}
