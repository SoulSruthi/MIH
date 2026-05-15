import { DlqTable } from '@/components/sources/DlqTable.js';

export default function DlqPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dead Letter Queue</h1>
        <p className="text-slate-500 mt-1">Review and replay failed lead imports from your connectors.</p>
      </div>
      <DlqTable />
    </div>
  );
}
