import type { Metadata } from 'next';
import { SpendManagement } from '@/components/roi/SpendManagement';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Spend Management — MIH',
};

export default function SpendPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Spend Management</h1>
        <p className="mt-1 text-sm text-slate-500">
          Log and manage marketing spend entries and vendor contracts.
        </p>
      </div>
      <SpendManagement />
    </div>
  );
}
