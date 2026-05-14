'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
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

// Types
type UniqueLeadRow = {
  id: string;
  primary_name: string;
  known_names: string[];
  primary_phone_e164: string;
  primary_email: string | null;
  primary_source: { id: string; name: string; source_type: string } | null;
  total_touches: number;
  first_seen_at: string;
  last_seen_at: string;
  crm_handoff_status: string;
};

type UniqueLeadsResponse = {
  leads: UniqueLeadRow[];
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

function CrmStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'succeeded':
      return <Badge variant="success">Succeeded</Badge>;
    case 'failed':
      return <Badge variant="destructive">Failed</Badge>;
    case 'pending':
    default:
      return <Badge variant="ghost">Pending</Badge>;
  }
}

function KnownNamesList({ names, primaryName }: { names: string[]; primaryName: string }) {
  const [open, setOpen] = useState(false);
  const extras = names.filter((n) => n !== primaryName);
  if (extras.length === 0) return null;

  return (
    <div className="mt-0.5">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-slate-600 transition-colors"
      >
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 cursor-pointer">
          +{extras.length} name{extras.length > 1 ? 's' : ''}
        </Badge>
      </button>
      {open && (
        <div className="mt-1 flex flex-wrap gap-1">
          {extras.map((name) => (
            <span
              key={name}
              className="inline-block rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const PER_PAGE = 20;

export function UniqueLeadsTable() {
  const [data, setData] = useState<UniqueLeadsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search]);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        page: String(page),
        per_page: String(PER_PAGE),
      });
      if (debouncedSearch) params.set('search', debouncedSearch);

      const res = await fetch(`/api/leads?${params.toString()}`, {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as UniqueLeadsResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leads');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void fetchLeads();
  }, [fetchLeads]);

  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));
  const showing = data
    ? `${(page - 1) * PER_PAGE + 1}–${Math.min(page * PER_PAGE, total)} of ${total}`
    : '—';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <CardTitle>Unique Leads</CardTitle>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search name, phone, email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-64 rounded-md border border-slate-200 bg-white pl-8 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
          />
        </div>
      </CardHeader>

      <CardContent className="p-0">
        {error ? (
          <div className="px-6 py-10 text-center text-sm text-red-600">{error}</div>
        ) : loading ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">Loading leads…</div>
        ) : !data || data.leads.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-slate-500">
            {debouncedSearch ? `No leads found matching "${debouncedSearch}".` : 'No leads yet.'}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Name</TableHead>
                <TableHead>Phone</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Touches</TableHead>
                <TableHead>First Seen</TableHead>
                <TableHead>Last Seen</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.leads.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium text-slate-900">{lead.primary_name}</span>
                      <KnownNamesList
                        names={lead.known_names}
                        primaryName={lead.primary_name}
                      />
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm text-slate-700">
                    {lead.primary_phone_e164}
                  </TableCell>
                  <TableCell>
                    {lead.primary_source ? (
                      <div>
                        <span className="text-sm font-medium text-slate-800">
                          {lead.primary_source.name}
                        </span>
                        <div className="text-xs text-slate-500 capitalize">
                          {lead.primary_source.source_type.replace(/_/g, ' ')}
                        </div>
                      </div>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="secondary" className="font-mono">
                      {lead.total_touches}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(lead.first_seen_at)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                    {formatDate(lead.last_seen_at)}
                  </TableCell>
                  <TableCell>
                    <CrmStatusBadge status={lead.crm_handoff_status} />
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
