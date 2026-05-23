'use client';

import { useState, useCallback, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Upload, CheckCircle, XCircle, Loader } from 'lucide-react';
import { useOrgId } from '@/lib/use-org-id';

type JobKind = 'leads' | 'opportunities' | 'contacts' | 'calls' | 'comments';

type ImportJob = {
  id: string;
  job_kind: JobKind;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  total_rows: number;
  processed_rows: number;
  error_rows: number;
  created_at: string;
  completed_at: string | null;
};

type ImportResult = {
  processed: number;
  errors: number;
  job_id: string;
};

const JOB_KINDS: { value: JobKind; label: string; desc: string }[] = [
  { value: 'leads', label: 'Leads', desc: 'SF Lead object export — Name, Phone, Email, LeadSource, CreatedDate' },
  { value: 'opportunities', label: 'Opportunities', desc: 'SF Opportunity export — Name, Amount, CloseDate, StageName' },
  { value: 'contacts', label: 'Contacts', desc: 'SF Contact export — FirstName, LastName, Phone, Email' },
  { value: 'calls', label: 'Calls', desc: 'SF Call/Activity export — Subject, CallType, ActivityDate, WhoId' },
  { value: 'comments', label: 'Comments / Notes', desc: 'SF Note/Comment export — Body, ParentId, CreatedDate' },
];

function statusBadge(status: ImportJob['status']) {
  switch (status) {
    case 'completed': return <Badge variant="success">Completed</Badge>;
    case 'failed': return <Badge variant="destructive">Failed</Badge>;
    case 'processing': return <Badge variant="info">Processing</Badge>;
    default: return <Badge variant="secondary">Pending</Badge>;
  }
}

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((v) => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = values[i] ?? ''; });
    return row;
  });
}

export function SalesforceImport() {
  const orgId = useOrgId();
  const [selectedKind, setSelectedKind] = useState<JobKind>('leads');
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const fetchJobs = useCallback(async () => {
    const res = await fetch('/api/reconciliation/sf-import', { headers: { 'x-org-id': orgId } });
    if (res.ok) {
      const d = (await res.json()) as { jobs: ImportJob[] };
      setJobs(d.jobs ?? []);
    }
  }, [orgId]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const rows = parseCSV(text);

      if (rows.length === 0) {
        setError('CSV file appears empty or malformed.');
        return;
      }

      // Create job
      const createRes = await fetch('/api/reconciliation/sf-import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ job_kind: selectedKind, mapping_config: {} }),
      });

      if (!createRes.ok) {
        const body = (await createRes.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${createRes.status}`);
      }

      const { job_id } = (await createRes.json()) as { job_id: string };

      // Process rows
      const processRes = await fetch(`/api/reconciliation/sf-import/${job_id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': orgId },
        body: JSON.stringify({ rows }),
      });

      if (!processRes.ok) {
        const body = (await processRes.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${processRes.status}`);
      }

      const importResult = (await processRes.json()) as ImportResult;
      setResult(importResult);
      await fetchJobs();
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Import form */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">New Import</CardTitle>
        </CardHeader>
        <CardContent className="px-5 py-5 space-y-5">
          {/* Object type selector */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">Salesforce Object</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {JOB_KINDS.map((k) => (
                <button
                  key={k.value}
                  type="button"
                  onClick={() => setSelectedKind(k.value)}
                  className={`text-left rounded-lg border px-3 py-2.5 transition-colors ${
                    selectedKind === k.value
                      ? 'border-blue-400 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span className="block text-sm font-semibold text-slate-800">{k.label}</span>
                  <span className="block text-xs text-slate-500 mt-0.5">{k.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* File upload */}
          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide">CSV File</label>
            <div className="flex items-center gap-3">
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="block text-sm text-slate-600 file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-medium file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200"
              />
              <Button
                size="sm"
                onClick={() => void handleUpload()}
                disabled={uploading}
                className="shrink-0"
              >
                {uploading ? (
                  <><Loader className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Importing…</>
                ) : (
                  <><Upload className="h-3.5 w-3.5 mr-1.5" /> Import</>
                )}
              </Button>
            </div>
            <p className="text-xs text-slate-400">
              First row must be headers. Backfill mode — commission accruals are suppressed for historical data.
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success */}
          {result && (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 flex items-start gap-2">
              <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-emerald-800">Import complete</p>
                <p className="text-xs text-emerald-700 mt-0.5">
                  {result.processed} rows processed · {result.errors} errors
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent jobs */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-slate-600">Import History</CardTitle>
            <Button variant="ghost" size="sm" onClick={() => void fetchJobs()} className="text-xs">
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {jobs.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No imports yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-slate-50">
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Object</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Status</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Rows</th>
                  <th className="px-4 py-2.5 text-right font-semibold text-slate-500">Errors</th>
                  <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Date</th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((j) => (
                  <tr key={j.id} className="border-b last:border-0 hover:bg-slate-50">
                    <td className="px-4 py-2.5 capitalize font-medium text-slate-800">{j.job_kind}</td>
                    <td className="px-4 py-2.5">{statusBadge(j.status)}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{j.processed_rows}</td>
                    <td className="px-4 py-2.5 text-right">
                      {j.error_rows > 0 ? (
                        <span className="text-red-600 font-medium">{j.error_rows}</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 text-xs whitespace-nowrap">
                      {new Date(j.created_at).toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
