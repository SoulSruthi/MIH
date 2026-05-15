'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight, AlertTriangle } from 'lucide-react';
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

// Types
type DedupAuditEntry = {
  raw_lead_id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  source: { id: string; name: string; source_type: string } | null;
  source_campaign_name: string | null;
  ingested_at: string;
  dedup_reason: 'within_window' | 'post_window_merge' | null;
  merged_into: {
    id: string;
    primary_name: string;
    primary_phone_e164: string;
    known_names: string[];
  } | null;
};

type DedupAuditResponse = {
  entries: DedupAuditEntry[];
  total: number;
  page: number;
  per_page: number;
};

// Helpers
function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
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

function DedupReasonBadge({ reason }: { reason: DedupAuditEntry['dedup_reason'] }) {
  if (reason === 'within_window') {
    return <Badge variant="info">Within Window</Badge>;
  }
  if (reason === 'post_window_merge') {
    return <Badge variant="warning">Post-Window Merge</Badge>;
  }
  return <Badge variant="ghost">Unknown</Badge>;
}

const PER_PAGE = 20;

export function DedupAuditTable() {
  const [data, setData] = useState<DedupAuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);

  // Unmerge dialog state
  const [unmergeTarget, setUnmergeTarget] = useState<DedupAuditEntry | null>(null);
  const [unmerging, setUnmerging] = useState(false);
  const [unmergeError, setUnmergeError] = useState<string | null>(null);

  const fetchAudit = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      const res = await fetch(`/api/leads/audit?${params.toString()}`, {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as DedupAuditResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit data');
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => {
    void fetchAudit();
  }, [fetchAudit]);

  const handleUnmerge = async () => {
    if (!unmergeTarget) return;
    setUnmerging(true);
    setUnmergeError(null);
    try {
      const res = await fetch('/api/leads/unmerge', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': 'demo-org-id',
        },
        body: JSON.stringify({ raw_lead_id: unmergeTarget.raw_lead_id }),
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      setUnmergeTarget(null);
      // Refresh the table
      void fetchAudit();
    } catch (err) {
      setUnmergeError(err instanceof Error ? err.message : 'Unmerge failed');
    } finally {
      setUnmerging(false);
    }
  };

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const showing = data
    ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`
    : '—';

  return (
    <>
      <Card>
        <CardHeader className="pb-4">
          <CardTitle>Dedup Audit</CardTitle>
          <p className="text-sm text-slate-500 mt-1">
            Leads identified as duplicates and merged into existing unique leads.
          </p>
        </CardHeader>

        <CardContent className="p-0">
          {error ? (
            <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
          ) : loading ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">Loading audit data…</div>
          ) : !data || data.entries.length === 0 ? (
            <div className="px-6 py-10 text-center text-sm text-slate-500">
              No duplicate entries found.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Name</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead>When</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Merged Into</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.entries.map((entry) => (
                  <TableRow key={entry.raw_lead_id}>
                    <TableCell className="font-medium text-slate-900">
                      {entry.name}
                    </TableCell>
                    <TableCell className="font-mono text-sm text-slate-700">
                      {entry.phone_e164}
                    </TableCell>
                    <TableCell>
                      {entry.source ? (
                        <div>
                          <span className="text-sm font-medium text-slate-800">
                            {entry.source.name}
                          </span>
                          <div className="text-xs text-slate-500 capitalize">
                            {entry.source.source_type.replace(/_/g, ' ')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {entry.source_campaign_name ?? (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(entry.ingested_at)}
                    </TableCell>
                    <TableCell>
                      <DedupReasonBadge reason={entry.dedup_reason} />
                    </TableCell>
                    <TableCell>
                      {entry.merged_into ? (
                        <div>
                          <span className="text-sm font-medium text-slate-800">
                            {entry.merged_into.primary_name}
                          </span>
                          <div className="font-mono text-xs text-slate-500">
                            {entry.merged_into.primary_phone_e164}
                          </div>
                        </div>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                        onClick={() => {
                          setUnmergeTarget(entry);
                          setUnmergeError(null);
                        }}
                      >
                        Unmerge
                      </Button>
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

      {/* Unmerge Confirmation Dialog */}
      <Dialog
        open={unmergeTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setUnmergeTarget(null);
            setUnmergeError(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Confirm Unmerge
            </DialogTitle>
            <DialogDescription>
              This will unmerge{' '}
              <span className="font-semibold text-slate-900">
                {unmergeTarget?.name}
              </span>{' '}
              ({unmergeTarget?.phone_e164}) from{' '}
              <span className="font-semibold text-slate-900">
                {unmergeTarget?.merged_into?.primary_name ?? 'the merged lead'}
              </span>
              . This action will restore the lead as a separate entry.
            </DialogDescription>
          </DialogHeader>

          {unmergeError && (
            <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {unmergeError}
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setUnmergeTarget(null);
                setUnmergeError(null);
              }}
              disabled={unmerging}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => void handleUnmerge()}
              disabled={unmerging}
            >
              {unmerging ? 'Unmerging…' : 'Yes, Unmerge'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
