'use client';

import { useEffect, useState, useCallback } from 'react';
import { useOrgId } from '@/lib/use-org-id';
import { Button } from '@/components/ui/button';

type SfImportJob = {
  id: string;
  job_kind: string;
  label: string | null;
  status: string;
  total_rows: number | null;
  processed_rows: number | null;
  error_rows: number | null;
  created_at: string;
  completed_at: string | null;
};

const JOB_KINDS = [
  { value: 'leads', label: 'Leads' },
  { value: 'opportunities', label: 'Opportunities' },
  { value: 'contacts', label: 'Contacts' },
  { value: 'calls', label: 'Calls' },
  { value: 'comments', label: 'Comments' },
];

export function SalesforceImport() {
  const orgId = useOrgId();
  const [jobs, setJobs] = useState<SfImportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [jobKind, setJobKind] = useState('leads');
  const [label, setLabel] = useState('');
  const [creating, setCreating] = useState(false);

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/reconciliation/sf-import', { headers: { 'x-org-id': orgId } });
    if (res.ok) {
      const data = await res.json() as { jobs: SfImportJob[] };
      setJobs(data.jobs);
    }
    setLoading(false);
  }, [orgId]);

  useEffect(() => { void fetchJobs(); }, [fetchJobs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const res = await fetch('/api/reconciliation/sf-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ job_kind: jobKind, label: label.trim() || null }),
      });
      if (res.ok) {
        setLabel('');
        await fetchJobs();
      }
    } finally {
      setCreating(false);
    }
  };

  const statusColor = (status: string) => {
    if (status === 'completed') return 'text-emerald-600';
    if (status === 'failed') return 'text-red-600';
    if (status === 'processing') return 'text-blue-600';
    return 'text-slate-500';
  };

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold text-slate-900">Salesforce Import Jobs</h1>

      {/* Create job */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 space-y-4">
        <h2 className="text-sm font-semibold text-slate-700">Create New Import Job</h2>
        <div className="flex gap-3 flex-wrap">
          <select
            value={jobKind}
            onChange={(e) => setJobKind(e.target.value)}
            className="rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {JOB_KINDS.map((k) => (
              <option key={k.value} value={k.value}>{k.label}</option>
            ))}
          </select>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label (optional)"
            className="flex-1 min-w-48 rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <Button size="sm" onClick={() => void handleCreate()} disabled={creating}>
            {creating ? 'Creating…' : 'Create Job'}
          </Button>
        </div>
      </div>

      {/* Jobs list */}
      {loading ? (
        <div className="py-12 text-center text-slate-400 animate-pulse">Loading…</div>
      ) : jobs.length === 0 ? (
        <div className="py-12 text-center text-slate-400">No import jobs yet.</div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="min-w-full divide-y divide-slate-100">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Kind</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Label</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Rows</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Errors</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {jobs.map((job) => (
                <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 text-sm text-slate-800 capitalize">{job.job_kind}</td>
                  <td className="px-4 py-3 text-sm text-slate-600">{job.label ?? '—'}</td>
                  <td className={`px-4 py-3 text-sm font-medium capitalize ${statusColor(job.status)}`}>{job.status}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">
                    {job.processed_rows ?? 0} / {job.total_rows ?? 0}
                  </td>
                  <td className={`px-4 py-3 text-sm font-medium ${(job.error_rows ?? 0) > 0 ? 'text-red-600' : 'text-slate-500'}`}>
                    {job.error_rows ?? 0}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {new Date(job.created_at).toLocaleDateString('en-IN', {
                      day: 'numeric', month: 'short', year: 'numeric',
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
