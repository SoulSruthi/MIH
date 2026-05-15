import { ManualLeadEntry } from '@/components/leads/ManualLeadEntry';

export default function LeadEntryPage() {
  return (
    <div className="container mx-auto p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Manual Lead Entry</h1>
        <p className="text-slate-500 mt-1">Enter leads manually or upload a CSV file.</p>
      </div>
      <ManualLeadEntry />
    </div>
  );
}
