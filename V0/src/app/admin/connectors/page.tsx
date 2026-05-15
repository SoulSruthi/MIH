import { ConnectorsDashboard } from '@/components/admin/ConnectorsDashboard';

export default function ConnectorsPage() {
  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Marketing Connectors</h1>
        <p className="text-slate-500 mt-1">
          Connect your marketing channels to automatically import leads.
        </p>
      </div>
      <ConnectorsDashboard />
    </div>
  );
}
