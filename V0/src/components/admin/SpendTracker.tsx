'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, PlusCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// ─── Types ────────────────────────────────────────────────────────────────────

type CompletenessRow = {
  source_id: string;
  source_name: string;
  source_type: string;
  status: 'complete' | 'partial' | 'missing';
  total_paise: number;
};

type CompletenessResponse = {
  start: string;
  end: string;
  completeness: CompletenessRow[];
};

type SpendEntry = {
  id: string;
  source_id: string;
  spend_date: string;
  amount_paise: number;
  campaign_name: string | null;
  data_source: string;
  sources: { id: string; name: string; source_type: string } | null;
};

type SpendResponse = {
  spend: SpendEntry[];
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatInr(paise: number): string {
  return (paise / 100).toLocaleString('en-IN', { style: 'currency', currency: 'INR' });
}

function todayIso(): string {
  return new Date().toISOString().split('T')[0] as string;
}

function last30DaysRange(): { start: string; end: string } {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    start: start.toISOString().split('T')[0] as string,
    end: end.toISOString().split('T')[0] as string,
  };
}

const STATUS_VARIANT: Record<CompletenessRow['status'], 'success' | 'warning' | 'destructive'> = {
  complete: 'success',
  partial: 'warning',
  missing: 'destructive',
};

const STATUS_LABEL: Record<CompletenessRow['status'], string> = {
  complete: 'Complete',
  partial: 'Partial',
  missing: 'Missing',
};

// ─── AddSpendForm ─────────────────────────────────────────────────────────────

type AddSpendFormProps = {
  sources: CompletenessRow[];
  onSuccess: () => void;
};

function AddSpendForm({ sources, onSuccess }: AddSpendFormProps) {
  const [sourceId, setSourceId] = useState('');
  const [spendDate, setSpendDate] = useState(todayIso());
  const [amountInr, setAmountInr] = useState('');
  const [campaignName, setCampaignName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceId || !spendDate || !amountInr) return;

    setSubmitting(true);
    setFeedback(null);

    try {
      const res = await fetch('/api/admin/spend', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({
          source_id: sourceId,
          spend_date: spendDate,
          amount_inr: parseFloat(amountInr),
          campaign_name: campaignName.trim() || undefined,
        }),
      });

      if (!res.ok) {
        const json = (await res.json()) as { error?: string };
        throw new Error(json.error ?? `HTTP ${res.status}`);
      }

      setFeedback({ type: 'success', msg: 'Spend entry added successfully.' });
      setAmountInr('');
      setCampaignName('');
      setSpendDate(todayIso());
      onSuccess();
    } catch (err) {
      setFeedback({
        type: 'error',
        msg: err instanceof Error ? err.message : 'Failed to save spend entry',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
      {/* Source selector */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700" htmlFor="spend-source">
          Source
        </label>
        <select
          id="spend-source"
          value={sourceId}
          onChange={(e) => setSourceId(e.target.value)}
          required
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Select a source…</option>
          {sources.map((s) => (
            <option key={s.source_id} value={s.source_id}>
              {s.source_name}
            </option>
          ))}
        </select>
      </div>

      {/* Date */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700" htmlFor="spend-date">
          Date
        </label>
        <input
          id="spend-date"
          type="date"
          value={spendDate}
          onChange={(e) => setSpendDate(e.target.value)}
          required
          max={todayIso()}
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Amount INR */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700" htmlFor="spend-amount">
          Amount (₹)
        </label>
        <input
          id="spend-amount"
          type="number"
          min="0"
          step="0.01"
          value={amountInr}
          onChange={(e) => setAmountInr(e.target.value)}
          required
          placeholder="0.00"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Campaign name (optional) */}
      <div className="space-y-1">
        <label className="text-xs font-medium text-slate-700" htmlFor="spend-campaign">
          Campaign name{' '}
          <span className="font-normal text-slate-400">(optional)</span>
        </label>
        <input
          id="spend-campaign"
          type="text"
          value={campaignName}
          onChange={(e) => setCampaignName(e.target.value)}
          placeholder="e.g. Summer Sale 2026"
          className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Feedback */}
      {feedback && (
        <p
          className={`text-sm rounded-md px-3 py-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-red-50 text-red-700 border border-red-200'
          }`}
        >
          {feedback.msg}
        </p>
      )}

      <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
        {submitting ? (
          <>
            <RefreshCw className="h-3.5 w-3.5 animate-spin mr-1.5" />
            Saving…
          </>
        ) : (
          <>
            <PlusCircle className="h-3.5 w-3.5 mr-1.5" />
            Add Entry
          </>
        )}
      </Button>
    </form>
  );
}

// ─── SpendTracker ─────────────────────────────────────────────────────────────

export function SpendTracker() {
  const [completeness, setCompleteness] = useState<CompletenessRow[]>([]);
  const [spendEntries, setSpendEntries] = useState<SpendEntry[]>([]);
  const [loadingCompleteness, setLoadingCompleteness] = useState(true);
  const [loadingSpend, setLoadingSpend] = useState(true);
  const [errorCompleteness, setErrorCompleteness] = useState<string | null>(null);
  const [errorSpend, setErrorSpend] = useState<string | null>(null);

  const fetchCompleteness = useCallback(async () => {
    setLoadingCompleteness(true);
    setErrorCompleteness(null);
    try {
      const { start, end } = last30DaysRange();
      const res = await fetch(
        `/api/admin/spend/completeness?start=${start}&end=${end}`,
        { headers: { 'x-org-id': 'demo-org-id' } },
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as CompletenessResponse;
      setCompleteness(json.completeness ?? []);
    } catch (err) {
      setErrorCompleteness(
        err instanceof Error ? err.message : 'Failed to load completeness data',
      );
    } finally {
      setLoadingCompleteness(false);
    }
  }, []);

  const fetchSpend = useCallback(async () => {
    setLoadingSpend(true);
    setErrorSpend(null);
    try {
      const res = await fetch('/api/admin/spend', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as SpendResponse;
      // Show last 20 entries (already ordered desc by spend_date from API)
      setSpendEntries((json.spend ?? []).slice(0, 20));
    } catch (err) {
      setErrorSpend(
        err instanceof Error ? err.message : 'Failed to load spend history',
      );
    } finally {
      setLoadingSpend(false);
    }
  }, []);

  const handleRefreshAll = useCallback(() => {
    void fetchCompleteness();
    void fetchSpend();
  }, [fetchCompleteness, fetchSpend]);

  useEffect(() => {
    void fetchCompleteness();
    void fetchSpend();
  }, [fetchCompleteness, fetchSpend]);

  const handleAddSuccess = useCallback(() => {
    void fetchCompleteness();
    void fetchSpend();
  }, [fetchCompleteness, fetchSpend]);

  return (
    <div className="space-y-6">
      {/* Section A: Add Spend Entry */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            Add Spend Entry
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingCompleteness && completeness.length === 0 ? (
            <div className="py-6 text-center text-sm text-slate-500">
              <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1.5 text-slate-400" />
              Loading sources…
            </div>
          ) : (
            <AddSpendForm sources={completeness} onSuccess={handleAddSuccess} />
          )}
        </CardContent>
      </Card>

      {/* Section B: Spend Completeness */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Spend Completeness
              </CardTitle>
              <p className="text-xs text-slate-500 mt-0.5">Last 30 days per source</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshAll}
              disabled={loadingCompleteness || loadingSpend}
            >
              <RefreshCw
                className={`h-3.5 w-3.5 mr-1.5 ${
                  loadingCompleteness || loadingSpend ? 'animate-spin' : ''
                }`}
              />
              Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingCompleteness ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading completeness…
            </div>
          ) : errorCompleteness ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorCompleteness}
              <Button
                variant="ghost"
                size="sm"
                className="ml-3"
                onClick={() => void fetchCompleteness()}
              >
                Retry
              </Button>
            </div>
          ) : completeness.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">No sources configured.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Total Spend</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {completeness.map((row) => (
                  <TableRow key={row.source_id}>
                    <TableCell className="font-medium text-slate-900">
                      {row.source_name}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[row.status]} className="text-xs">
                        {STATUS_LABEL[row.status]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-slate-700 tabular-nums">
                      {formatInr(row.total_paise)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Section C: Recent Spend History */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold text-slate-900">
            Recent Spend History
          </CardTitle>
          <p className="text-xs text-slate-500 mt-0.5">Last 20 entries</p>
        </CardHeader>
        <CardContent>
          {loadingSpend ? (
            <div className="py-8 text-center text-sm text-slate-500">
              Loading spend history…
            </div>
          ) : errorSpend ? (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {errorSpend}
              <Button
                variant="ghost"
                size="sm"
                className="ml-3"
                onClick={() => void fetchSpend()}
              >
                Retry
              </Button>
            </div>
          ) : spendEntries.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              No spend entries recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Data Source</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {spendEntries.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-medium text-slate-900">
                      {entry.sources?.name ?? entry.source_id}
                    </TableCell>
                    <TableCell className="text-slate-600 tabular-nums">
                      {new Intl.DateTimeFormat('en-IN', { dateStyle: 'short' }).format(
                        new Date(entry.spend_date),
                      )}
                    </TableCell>
                    <TableCell className="text-slate-500 max-w-[180px] truncate">
                      {entry.campaign_name ?? <span className="text-slate-300">—</span>}
                    </TableCell>
                    <TableCell className="text-right text-slate-700 tabular-nums">
                      {formatInr(entry.amount_paise)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={entry.data_source === 'manual' ? 'ghost' : 'info'}
                        className="text-xs capitalize"
                      >
                        {entry.data_source}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
