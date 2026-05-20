'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, UserPlus, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import type { SourceCategory } from '@/app/api/admin/sources/route';

// ─── Types ────────────────────────────────────────────────────────────────────

type SourcesResponse = {
  categories?: SourceCategory[];
  // Some routes return a flat sources array — handled via union
  sources?: { id: string; name: string; source_type?: string }[];
};

type LeadSource = {
  id: string;
  name: string;
  source_type?: string;
};

type ParsedLead = {
  name: string;
  phone: string;
  email: string;
  source_campaign_name: string;
};

type ManualLeadResponse = {
  ok?: boolean;
  error?: string;
  inserted?: number;
  message?: string;
};

type CostResponse = {
  ok?: boolean;
  error?: string;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseCSV(text: string): ParsedLead[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  // Detect header by checking if first line contains alphabetic-only columns
  const firstLine = lines[0].toLowerCase();
  const hasHeader =
    firstLine.includes('name') ||
    firstLine.includes('phone') ||
    firstLine.includes('email') ||
    firstLine.includes('mobile');

  const dataLines = hasHeader ? lines.slice(1) : lines;

  return dataLines.map((line) => {
    // Simple CSV split — handles quoted fields with commas
    const cols = splitCSVLine(line);
    if (hasHeader) {
      // Map by detected header columns
      const headers = splitCSVLine(lines[0]);
      const row: Record<string, string> = {};
      headers.forEach((h, i) => {
        row[h.toLowerCase().trim()] = cols[i]?.trim() ?? '';
      });
      return {
        name: row['name'] ?? row['full name'] ?? row['fullname'] ?? '',
        phone: row['phone'] ?? row['mobile'] ?? row['phone number'] ?? '',
        email: row['email'] ?? row['email address'] ?? '',
        source_campaign_name: row['campaign'] ?? row['source campaign'] ?? row['campaign name'] ?? '',
      };
    }
    // No header: assume columns are name, phone, email, campaign
    return {
      name: cols[0]?.trim() ?? '',
      phone: cols[1]?.trim() ?? '',
      email: cols[2]?.trim() ?? '',
      source_campaign_name: cols[3]?.trim() ?? '',
    };
  });
}

function splitCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

// ─── SourceSelector ───────────────────────────────────────────────────────────

type SourceSelectorProps = {
  sources: LeadSource[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean;
};

function SourceSelector({ sources, value, onChange, disabled }: SourceSelectorProps) {
  return (
    <div className="space-y-1">
      <label htmlFor="source-select" className="text-sm font-medium text-slate-700">
        Source <span className="text-red-500">*</span>
      </label>
      <select
        id="source-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
      >
        <option value="">— Select a source —</option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
            {s.source_type ? ` (${s.source_type.replace(/_/g, ' ')})` : ''}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── CostSection ──────────────────────────────────────────────────────────────

type CostSectionProps = {
  sourceId: string;
  onCostRecorded?: () => void;
};

function CostSection({ sourceId, onCostRecorded }: CostSectionProps) {
  const [expanded, setExpanded] = useState(false);
  const [amountInr, setAmountInr] = useState('');
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amountInr || !periodStart || !periodEnd) {
      setError('Amount, period start, and period end are required');
      return;
    }
    const amt = parseFloat(amountInr);
    if (isNaN(amt) || amt < 0) {
      setError('Enter a valid amount');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/costs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({
          source_id: sourceId,
          period_start: periodStart,
          period_end: periodEnd,
          amount_inr: amt,
          notes: notes.trim() || undefined,
        }),
      });

      const json = (await res.json()) as CostResponse;
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Failed to record cost');
        return;
      }
      setSuccess(true);
      onCostRecorded?.();
      // Reset form
      setAmountInr('');
      setPeriodStart('');
      setPeriodEnd('');
      setNotes('');
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to record cost');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="border border-slate-200 rounded-lg">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 rounded-lg"
      >
        <span>Record marketing cost for this period (optional)</span>
        <span className="text-slate-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <form onSubmit={(e) => void handleSubmit(e)} className="px-4 pb-4 space-y-3 border-t border-slate-100 mt-0 pt-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label htmlFor="cost-start" className="text-xs font-medium text-slate-600">
                Period Start
              </label>
              <input
                id="cost-start"
                type="date"
                value={periodStart}
                onChange={(e) => setPeriodStart(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="cost-end" className="text-xs font-medium text-slate-600">
                Period End
              </label>
              <input
                id="cost-end"
                type="date"
                value={periodEnd}
                onChange={(e) => setPeriodEnd(e.target.value)}
                className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor="cost-amount" className="text-xs font-medium text-slate-600">
              Amount (INR ₹)
            </label>
            <input
              id="cost-amount"
              type="number"
              min="0"
              step="0.01"
              value={amountInr}
              onChange={(e) => setAmountInr(e.target.value)}
              placeholder="e.g. 50000"
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="space-y-1">
            <label htmlFor="cost-notes" className="text-xs font-medium text-slate-600">
              Notes (optional)
            </label>
            <input
              id="cost-notes"
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Q1 Meta Ads spend"
              className="w-full rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              Cost recorded successfully.
            </div>
          )}

          <Button type="submit" size="sm" disabled={saving}>
            {saving ? 'Saving…' : 'Record Cost'}
          </Button>
        </form>
      )}
    </div>
  );
}

// ─── SingleEntryForm ──────────────────────────────────────────────────────────

type SingleEntryFormProps = {
  sources: LeadSource[];
};

function SingleEntryForm({ sources }: SingleEntryFormProps) {
  const [sourceId, setSourceId] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [campaign, setCampaign] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId) { setError('Please select a source'); return; }
    if (!name.trim()) { setError('Name is required'); return; }
    if (!phone.trim()) { setError('Phone is required'); return; }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/leads/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({
          source_id: sourceId,
          leads: [
            {
              name: name.trim(),
              phone: phone.trim(),
              email: email.trim() || undefined,
              source_campaign_name: campaign.trim() || undefined,
              notes: notes.trim() || undefined,
            },
          ],
        }),
      });

      const json = (await res.json()) as ManualLeadResponse;
      if (!res.ok || !json.ok) {
        setError(json.error ?? 'Submission failed');
        return;
      }
      setSuccessMsg(json.message ?? '1 lead submitted.');
      setName('');
      setPhone('');
      setEmail('');
      setCampaign('');
      setNotes('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      <SourceSelector sources={sources} value={sourceId} onChange={setSourceId} disabled={submitting} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1">
          <label htmlFor="lead-name" className="text-sm font-medium text-slate-700">
            Name <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
            disabled={submitting}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="lead-phone" className="text-sm font-medium text-slate-700">
            Phone <span className="text-red-500">*</span>
          </label>
          <input
            id="lead-phone"
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+91 98765 43210"
            disabled={submitting}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="lead-email" className="text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="lead-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="optional@example.com"
            disabled={submitting}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>

        <div className="space-y-1">
          <label htmlFor="lead-campaign" className="text-sm font-medium text-slate-700">
            Campaign Name
          </label>
          <input
            id="lead-campaign"
            type="text"
            value={campaign}
            onChange={(e) => setCampaign(e.target.value)}
            placeholder="e.g. Diwali 2025"
            disabled={submitting}
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
          />
        </div>
      </div>

      <div className="space-y-1">
        <label htmlFor="lead-notes" className="text-sm font-medium text-slate-700">
          Notes
        </label>
        <textarea
          id="lead-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="Any additional notes…"
          disabled={submitting}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 resize-none"
        />
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {sourceId && <CostSection sourceId={sourceId} />}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? 'Submitting…' : 'Submit Lead'}
      </Button>
    </form>
  );
}

// ─── BulkCSVUpload ────────────────────────────────────────────────────────────

type BulkCSVUploadProps = {
  sources: LeadSource[];
};

function BulkCSVUpload({ sources }: BulkCSVUploadProps) {
  const [sourceId, setSourceId] = useState('');
  const [parsedLeads, setParsedLeads] = useState<ParsedLead[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file.name.endsWith('.csv')) {
      setParseError('Please upload a .csv file');
      return;
    }
    setFileName(file.name);
    setParseError(null);
    setSuccessMsg(null);
    setSubmitError(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result;
      if (typeof text !== 'string') {
        setParseError('Could not read file');
        return;
      }
      const leads = parseCSV(text);
      if (leads.length === 0) {
        setParseError('No leads found in the CSV file');
        return;
      }
      if (leads.length > 500) {
        setParseError(`CSV has ${leads.length} rows — max 500 per batch. Please split the file.`);
        return;
      }
      setParsedLeads(leads);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!sourceId) { setSubmitError('Please select a source'); return; }
    if (parsedLeads.length === 0) { setSubmitError('No leads to submit'); return; }

    const validLeads = parsedLeads.filter((l) => l.name.trim() || l.phone.trim());
    if (validLeads.length === 0) {
      setSubmitError('No valid leads found (name or phone required)');
      return;
    }

    setSubmitting(true);
    setSubmitError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/leads/manual', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({
          source_id: sourceId,
          leads: validLeads.map((l) => ({
            name: l.name,
            phone: l.phone,
            email: l.email || undefined,
            source_campaign_name: l.source_campaign_name || undefined,
          })),
        }),
      });

      const json = (await res.json()) as ManualLeadResponse;
      if (!res.ok || !json.ok) {
        setSubmitError(json.error ?? 'Submission failed');
        return;
      }
      setSuccessMsg(json.message ?? `${json.inserted ?? validLeads.length} leads submitted.`);
      setParsedLeads([]);
      setFileName(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Submission failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      <SourceSelector sources={sources} value={sourceId} onChange={setSourceId} disabled={submitting} />

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={[
          'flex flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center cursor-pointer transition-colors',
          isDragging
            ? 'border-blue-400 bg-blue-50'
            : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-slate-100',
        ].join(' ')}
      >
        <Upload className="h-8 w-8 text-slate-400 mb-2" />
        {fileName ? (
          <>
            <p className="text-sm font-medium text-slate-800">{fileName}</p>
            <p className="text-xs text-slate-500 mt-1">
              {parsedLeads.length > 0 ? `${parsedLeads.length} leads parsed` : 'Parsing…'}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-slate-700">Drop a CSV file here, or click to browse</p>
            <p className="text-xs text-slate-400 mt-1">
              Columns: name, phone, email (optional), campaign (optional) — max 500 rows
            </p>
          </>
        )}
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv"
          className="sr-only"
          onChange={handleInputChange}
        />
      </div>

      {parseError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {parseError}
        </div>
      )}

      {/* Preview table */}
      {parsedLeads.length > 0 && (
        <div className="rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-200">
            <p className="text-xs font-semibold text-slate-600 uppercase tracking-wide">
              Preview — {parsedLeads.length} rows
            </p>
            <Badge variant="info">{parsedLeads.length} leads</Badge>
          </div>
          <div className="overflow-x-auto max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 sticky top-0 text-xs text-slate-500 uppercase">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Name</th>
                  <th className="px-3 py-2 text-left font-medium">Phone</th>
                  <th className="px-3 py-2 text-left font-medium">Email</th>
                  <th className="px-3 py-2 text-left font-medium">Campaign</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {parsedLeads.slice(0, 20).map((lead, idx) => (
                  <tr key={idx} className="hover:bg-slate-50">
                    <td className="px-3 py-2 text-slate-900 font-medium whitespace-nowrap">
                      {lead.name || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 font-mono text-slate-700 whitespace-nowrap">
                      {lead.phone || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {lead.email || <span className="text-slate-400">—</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                      {lead.source_campaign_name || <span className="text-slate-400">—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {parsedLeads.length > 20 && (
              <p className="px-3 py-2 text-xs text-slate-400 text-center border-t border-slate-100">
                … and {parsedLeads.length - 20} more rows (not shown)
              </p>
            )}
          </div>
        </div>
      )}

      {submitError && (
        <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
          {submitError}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
          {successMsg}
        </div>
      )}

      {sourceId && parsedLeads.length > 0 && (
        <CostSection sourceId={sourceId} />
      )}

      <Button
        onClick={() => void handleSubmit()}
        disabled={submitting || parsedLeads.length === 0}
        className="w-full sm:w-auto"
      >
        {submitting
          ? 'Uploading…'
          : parsedLeads.length > 0
          ? `Submit ${parsedLeads.length} Leads`
          : 'Submit Leads'}
      </Button>
    </div>
  );
}

// ─── ManualLeadEntry (main export) ────────────────────────────────────────────

export function ManualLeadEntry() {
  const [sources, setSources] = useState<LeadSource[]>([]);
  const [loadingSource, setLoadingSource] = useState(true);
  const [sourceError, setSourceError] = useState<string | null>(null);

  const fetchSources = useCallback(async () => {
    setLoadingSource(true);
    setSourceError(null);
    try {
      // Try /api/leads/sources first, fall back to /api/admin/sources
      let data: SourcesResponse | null = null;
      try {
        const res = await fetch('/api/leads/sources', {
          headers: { 'x-org-id': 'demo-org-id' },
        });
        if (res.ok) {
          data = (await res.json()) as SourcesResponse;
        }
      } catch {
        // fall through to admin route
      }

      if (!data) {
        const res = await fetch('/api/admin/sources', {
          headers: { 'x-org-id': 'demo-org-id' },
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        data = (await res.json()) as SourcesResponse;
      }

      // Normalise: some routes return `sources`, some `categories`
      if (data.sources && data.sources.length > 0) {
        setSources(data.sources as LeadSource[]);
      } else if (data.categories && data.categories.length > 0) {
        // Map categories to source-like objects for the selector
        setSources(
          data.categories.map((c) => ({
            id: c.id,
            name: `${c.name} (${c.category})`,
            source_type: c.category,
          })),
        );
      } else {
        setSources([]);
      }
    } catch (err) {
      setSourceError(err instanceof Error ? err.message : 'Failed to load sources');
    } finally {
      setLoadingSource(false);
    }
  }, []);

  useEffect(() => {
    void fetchSources();
  }, [fetchSources]);

  if (loadingSource) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading sources…</div>
    );
  }

  if (sourceError) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {sourceError}
        <Button variant="ghost" size="sm" className="ml-3" onClick={() => void fetchSources()}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <Tabs defaultValue="single">
      <TabsList className="mb-4">
        <TabsTrigger value="single">
          <UserPlus className="h-3.5 w-3.5 mr-1.5" />
          Single Entry
        </TabsTrigger>
        <TabsTrigger value="bulk">
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          Bulk CSV
        </TabsTrigger>
      </TabsList>

      <TabsContent value="single">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-slate-500" />
              Enter Single Lead
            </CardTitle>
          </CardHeader>
          <CardContent>
            <SingleEntryForm sources={sources} />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="bulk">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-4 w-4 text-slate-500" />
              Bulk CSV Upload
            </CardTitle>
          </CardHeader>
          <CardContent>
            <BulkCSVUpload sources={sources} />
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
