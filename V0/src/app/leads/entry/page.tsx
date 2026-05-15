import { ManualLeadEntry } from '@/components/leads/ManualLeadEntry';

export default function LeadEntryPage() {
  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Manual Lead Entry</h1>
        <p className="text-slate-500 mt-1">Enter leads manually or upload a CSV file.</p>
      </div>
      <ManualLeadEntry />
    </div>
  );
}
