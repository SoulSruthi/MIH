import { BillingDashboard } from '@/components/admin/BillingDashboard.js';

export default function BillingPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Billing</h1>
        <p className="text-slate-500 mt-1">Manage your subscription and view invoices.</p>
      </div>
      <BillingDashboard />
    </div>
  );
}
