import { ConnectorsDashboard } from '@/components/admin/ConnectorsDashboard';

export const dynamic = 'force-dynamic';

export default function ConnectorsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Marketing Connectors</h1>
        <p className="text-slate-500 mt-1">Connect your marketing channels to automatically import leads.</p>
      </div>
      <ConnectorsDashboard />
    </div>
  );
}
