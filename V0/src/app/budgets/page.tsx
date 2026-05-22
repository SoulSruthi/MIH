import type { Metadata } from 'next';
import { BudgetsDashboard } from '@/components/budgets/BudgetsDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Budgets — MIH',
};

export default function BudgetsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Budget Planning</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage annual marketing budgets, period breakdowns, and plan-vs-actual variance.
        </p>
      </div>
      <BudgetsDashboard />
    </div>
  );
}
