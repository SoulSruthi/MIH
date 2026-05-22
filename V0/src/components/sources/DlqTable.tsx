'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, RefreshCw, AlertTriangle } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { DlqEntry } from '@/app/api/sources/dlq/route';
import { useOrgId } from '@/lib/use-org-id';

type DlqResponse = {
  entries: DlqEntry[];
  total: number;
  page: number;
  per_page: number;
};

type ActionState = {
  id: string;
  action: 'replay' | 'ignore';
};

const PER_PAGE = 20;

const FAILURE_STAGES = ['fetch', 'normalize', 'ingest', 'dedup', 'handoff'] as const;
const STATUSES = ['failed', 'retrying', 'replayed', 'ignored'] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'ignored':
      return <Badge variant="ghost">Ignored</Badge>;
    case 'retrying':
      return <Badge variant="warning">Retrying</Badge>;
    case 'replayed':
      return <Badge variant="success">Replayed</Badge>;
    default:
      return <Badge variant="ghost">{status}</Badge>;
  }
}

function TruncatedError({ message }: { message: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = message.length > 80;

  if (!isLong) {
    return <span className="text-sm text-slate-600">{message}</span>;
  }

  return (
    <span className="text-sm text-slate-600">
      {expanded ? message : `${message.slice(0, 80)}…`}{' '}
      <button
        className="text-xs text-blue-600 hover:underline ml-1"
        onClick={() => setExpanded((v) => !v)}
        type="button"
      >
        {expanded ? 'less' : 'more'}
      </button>
    </span>
  );
}

// ─── Filter bar ───────────────────────────────────────────────────────────────

type Filters = {
  source_id: string;
  status: string;
  failure_stage: string;
};

type FilterBarProps = {
  filters: Filters;
  sourceOptions: Array<{ id: string; name: string }>;
  onChange: (f: Filters) => void;
};

function FilterBar({ filters, sourceOptions, onChange }: FilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-3 mb-4">
      {/* Source filter */}
      <select
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={filters.source_id}
        onChange={(e) => onChange({ ...filters, source_id: e.target.value })}
      >
        <option value="">All Sources</option>
        {sourceOptions.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))}
      </select>

      {/* Status filter */}
      <select
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={filters.status}
        onChange={(e) => onChange({ ...filters, status: e.target.value })}
      >
        <option value="">All Statuses</option>
        {STATUSES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>

      {/* Failure stage filter */}
      <select
        className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        value={filters.failure_stage}
        onChange={(e) => onChange({ ...filters, failure_stage: e.target.value })}
      >
        <option value="">All Stages</option>
        {FAILURE_STAGES.map((s) => (
          <option key={s} value={s}>
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </option>
        ))}
      </select>
    </div>
  );
}

// ─── DlqTable ─────────────────────────────────────────────────────────────────

export function DlqTable() {
  const [data, setData] = useState<DlqResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Filters>({
    source_id: '',
    status: '',
    failure_stage: '',
  });
  const [acting, setActing] = useState<ActionState | null>(null);
  const [bulkActing, setBulkActing] = useState<string | null>(null); // source_id being bulk-replayed
  const [actionError, setActionError] = useState<string | null>(null);

  // Derived source list from loaded entries for the filter dropdown
  const sourceOptions = data
    ? Array.from(
        new Map(
          data.entries.map((e) => [e.source_id, { id: e.source_id, name: e.source_name }]),
        ).values(),
      )
    : [];

  const fetchDlq = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
      if (filters.source_id) params.set('source_id', filters.source_id);
      if (filters.status) params.set('status', filters.status);
      if (filters.failure_stage) params.set('failure_stage', filters.failure_stage);

      const res = await fetch(`/api/sources/dlq?${params.toString()}`, {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DlqResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load DLQ data');
    } finally {
      setLoading(false);
    }
  }, [page, filters]);

  useEffect(() => {
    void fetchDlq();
  }, [fetchDlq]);

  // Reset to page 1 when filters change
  const handleFilterChange = (f: Filters) => {
    setFilters(f);
    setPage(1);
  };

  const handleAction = async (dlqId: string, action: 'replay' | 'ignore') => {
    setActing({ id: dlqId, action });
    setActionError(null);
    try {
      const res = await fetch('/api/sources/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'demo-org-id' },
        body: JSON.stringify({ action, dlq_id: dlqId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      void fetchDlq();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Action failed');
    } finally {
      setActing(null);
    }
  };

  const handleBulkReplay = async (sourceId: string) => {
    setBulkActing(sourceId);
    setActionError(null);
    try {
      const res = await fetch('/api/sources/dlq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-org-id': 'demo-org-id' },
        body: JSON.stringify({ action: 'replay', source_id: sourceId }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      void fetchDlq();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Bulk replay failed');
    } finally {
      setBulkActing(null);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const showing = data
    ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`
    : '—';

  // Group entries by source for bulk action buttons
  const sourceGroups = data
    ? Array.from(
        data.entries.reduce((map, entry) => {
          if (!map.has(entry.source_id)) {
            map.set(entry.source_id, { name: entry.source_name, failedCount: 0 });
          }
          if (entry.status === 'failed') {
            map.get(entry.source_id)!.failedCount++;
          }
          return map;
        }, new Map<string, { name: string; failedCount: number }>()),
      )
    : [];

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>DLQ Entries</CardTitle>
            <p className="text-sm text-slate-500 mt-1">
              Failed connector records awaiting replay or dismissal.
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void fetchDlq()}
            disabled={loading}
            aria-label="Refresh"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <FilterBar
          filters={filters}
          sourceOptions={sourceOptions}
          onChange={handleFilterChange}
        />

        {/* Bulk actions per source group */}
        {sourceGroups.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-2">
            {sourceGroups.map(([srcId, { name, failedCount }]) =>
              failedCount > 0 ? (
                <Button
                  key={srcId}
                  variant="outline"
                  size="sm"
                  onClick={() => void handleBulkReplay(srcId)}
                  disabled={bulkActing === srcId}
                  className="text-xs"
                >
                  {bulkActing === srcId ? (
                    <RefreshCw className="h-3 w-3 animate-spin mr-1" />
                  ) : null}
                  Replay All Failed — {name} ({failedCount})
                </Button>
              ) : null,
            )}
          </div>
        )}

        {actionError && (
          <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 mt-2">
            <AlertTriangle className="h-4 w-4 flex-shrink-0" />
            {actionError}
          </div>
        )}
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Loading DLQ data…</div>
        ) : !data || data.entries.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            No DLQ entries found.
            {(filters.status || filters.source_id || filters.failure_stage) && (
              <button
                className="ml-2 text-blue-600 hover:underline"
                onClick={() =>
                  handleFilterChange({ source_id: '', status: '', failure_stage: '' })
                }
                type="button"
              >
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Source</TableHead>
                <TableHead>Failure Stage</TableHead>
                <TableHead>Error</TableHead>
                <TableHead className="text-right">Retries</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-36"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell>
                    <div>
                      <span className="text-sm font-medium text-slate-900">
                        {entry.source_name}
                      </span>
                      {entry.source_type && (
                        <div className="text-xs text-slate-500 capitalize">
                          {entry.source_type.replace(/_/g, ' ')}
                        </div>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs font-mono text-slate-700">
                      {entry.failure_stage}
                    </span>
                  </TableCell>
                  <TableCell className="max-w-xs">
                    <TruncatedError message={entry.error_message} />
                  </TableCell>
                  <TableCell className="text-right text-sm text-slate-600">
                    {entry.retry_count}
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={entry.status} />
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(entry.created_at)}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      {entry.status === 'failed' && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs h-7"
                          onClick={() => void handleAction(entry.id, 'replay')}
                          disabled={acting?.id === entry.id}
                        >
                          {acting?.id === entry.id && acting.action === 'replay' ? (
                            <RefreshCw className="h-3 w-3 animate-spin" />
                          ) : (
                            'Replay'
                          )}
                        </Button>
                      )}
                      {entry.status !== 'ignored' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-xs h-7 text-slate-500 hover:text-slate-700"
                          onClick={() => void handleAction(entry.id, 'ignore')}
                          disabled={acting?.id === entry.id}
                        >
                          {acting?.id === entry.id && acting.action === 'ignore'
                            ? '…'
                            : 'Ignore'}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {!loading && !error && data && total > 0 && (
          <div className="flex items-center justify-between border-t border-slate-100 px-4 py-3">
            <span className="text-sm text-slate-500">Showing {showing}</span>
            <div className="flex items-center gap-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
                aria-label="First page"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </Button>
              <span className="px-2 text-sm text-slate-600">
                {page} / {totalPages}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                aria-label="Next page"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPage(totalPages)}
                disabled={page >= totalPages}
                aria-label="Last page"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
