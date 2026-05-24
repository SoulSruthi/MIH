import type { Metadata } from 'next';
import { BudgetDashboard } from '@/components/budget/BudgetDashboard';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Budget Plans — MIH',
};

export default function BudgetPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Budget Plans</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage annual marketing budgets, periods, and allocations.
        </p>
      </div>
      <BudgetDashboard />
    </div>
  );
}
