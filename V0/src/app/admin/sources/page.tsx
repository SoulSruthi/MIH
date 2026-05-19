import { SourcesDashboard } from '@/components/admin/SourcesDashboard';

export const dynamic = 'force-dynamic';

export default function SourcesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketing Sources</h1>
        <p className="text-slate-500 mt-1">Browse and create custom marketing source categories across ATL, BTL, Digital, and Niche channels.</p>
      </div>
      <SourcesDashboard />
    </div>
  );
}
