import { SourcesDashboard } from '@/components/admin/SourcesDashboard';

export default function SourcesPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Marketing Sources</h1>
        <p className="text-slate-500 mt-1">
          Browse and create custom marketing source categories across ATL, BTL, Digital, and Niche
          channels.
        </p>
      </div>
      <SourcesDashboard />
    </div>
  );
}
