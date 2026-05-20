'use client';

import { useEffect, useState, useCallback } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';

const ORG_ID = 'demo-org-id';

type RawInboxRow = {
  id: string;
  received_at: string;
  source_id: string | null;
  ingestion_path: string;
  processing_state: string;
  manual_review_flag: string | null;
  normalized: { phone_e164?: string; name?: string; email?: string } | null;
};

type Stats = {
  total: number;
  by_state: Record<string, number>;
};

const STATE_VARIANT: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  pending: 'outline',
  normalized: 'secondary',
  dedup_queued: 'default',
  rejected: 'destructive',
  manual_review: 'secondary',
};

export default function InboxPage() {
  const [leads, setLeads] = useState<RawInboxRow[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [filterState, setFilterState] = useState('all');

  const fetchData = useCallback(async (state: string) => {
    setLoading(true);
    const params = new URLSearchParams({ limit: '100' });
    if (state !== 'all') params.set('processing_state', state);

    const [leadsRes, statsRes] = await Promise.all([
      fetch(`/api/raw-inbox?${params.toString()}`, { headers: { 'x-org-id': ORG_ID } }),
      fetch('/api/raw-inbox/stats', { headers: { 'x-org-id': ORG_ID } }),
    ]);

    if (leadsRes.ok) {
      const d = await leadsRes.json() as { leads: RawInboxRow[] };
      setLeads(d.leads);
    }
    if (statsRes.ok) {
      const d = await statsRes.json() as Stats;
      setStats(d);
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(filterState); }, [fetchData, filterState]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Raw Lead Inbox</h1>
        <p className="text-slate-500 mt-1 text-sm">
          All incoming leads across every ingestion channel before identity resolution.
        </p>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-1 pt-3 px-4">
              <CardTitle className="text-xs text-slate-500 font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <p className="text-2xl font-bold text-slate-900">{stats.total}</p>
            </CardContent>
          </Card>
          {['pending', 'normalized', 'rejected'].map((s) => (
            <Card key={s}>
              <CardHeader className="pb-1 pt-3 px-4">
                <CardTitle className="text-xs text-slate-500 font-medium capitalize">{s}</CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <p className="text-2xl font-bold text-slate-900">{stats.by_state[s] ?? 0}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      <Tabs value={filterState} onValueChange={(v) => setFilterState(v)}>
        <TabsList>
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="normalized">Normalized</TabsTrigger>
          <TabsTrigger value="manual_review">Review</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-sm">Loading...</div>
          ) : leads.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">No leads in inbox yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Received</TableHead>
                  <TableHead>Phone</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Path</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Flag</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {leads.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm text-slate-600 whitespace-nowrap">
                      {formatDate(row.received_at)}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {row.normalized?.phone_e164 ?? '—'}
                    </TableCell>
                    <TableCell className="text-sm">{row.normalized?.name ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{row.source_id ?? '—'}</TableCell>
                    <TableCell className="text-xs text-slate-500">{row.ingestion_path}</TableCell>
                    <TableCell>
                      <Badge variant={STATE_VARIANT[row.processing_state] ?? 'outline'}>
                        {row.processing_state}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-slate-500">
                      {row.manual_review_flag ?? '—'}
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
