import { BillingDashboard } from '@/components/admin/BillingDashboard.js';

export default function BillingPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-500 mt-1">Manage your subscription and view invoices.</p>
      </div>
      <BillingDashboard />
    </div>
  );
}
