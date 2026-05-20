import { DedupRulesEditor } from '@/components/admin/DedupRulesEditor';

export const dynamic = 'force-dynamic';

export default function DedupRulesPage() {
  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Dedup Rules</h1>
        <p className="text-slate-500 mt-1">Configure how duplicate leads are detected for your organisation.</p>
      </div>
      <DedupRulesEditor />
    </div>
  );
}
