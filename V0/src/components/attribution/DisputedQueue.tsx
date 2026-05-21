'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const ORG_ID = 'demo-org-id';

type DisputeState = 'open' | 'in_review' | 'resolved';

type Dispute = {
  id: string;
  conversion_event_id: string;
  dispute_reason: string;
  state: DisputeState;
  created_at: string;
};

const STATE_TABS: { label: string; value: DisputeState }[] = [
  { label: 'Open', value: 'open' },
  { label: 'In Review', value: 'in_review' },
  { label: 'Resolved', value: 'resolved' },
];

const STATE_BADGE: Record<
  DisputeState,
  'destructive' | 'warning' | 'success'
> = {
  open: 'destructive',
  in_review: 'warning',
  resolved: 'success',
};

export function DisputedQueue() {
  const [activeState, setActiveState] = useState<DisputeState>('open');
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [markingId, setMarkingId] = useState<string | null>(null);

  const fetchDisputes = useCallback(async (state: DisputeState) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/attribution/disputed?state=${state}`, {
        headers: { 'x-org-id': ORG_ID },
      });
      if (!res.ok) {
        setError(`Failed to load disputes (HTTP ${res.status}).`);
        return;
      }
      const d = (await res.json()) as Dispute[] | { disputes: Dispute[] };
      setDisputes(Array.isArray(d) ? d : (d.disputes ?? []));
    } catch {
      setError('Failed to load disputes.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDisputes(activeState);
  }, [activeState, fetchDisputes]);

  const handleMarkInReview = async (id: string) => {
    setMarkingId(id);
    try {
      const res = await fetch(`/api/attribution/disputed/${id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-org-id': ORG_ID,
        },
        body: JSON.stringify({ state: 'in_review' }),
      });
      if (res.ok) {
        // Remove from current list after marking in review (if viewing open)
        setDisputes((prev) => prev.filter((d) => d.id !== id));
      }
    } catch {
      // silently ignore — user can retry
    } finally {
      setMarkingId(null);
    }
  };

  const formatDate = (iso: string) => {
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-6">
      {/* State filter tabs */}
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 w-fit">
        {STATE_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveState(tab.value)}
            className={`rounded-md px-4 py-1.5 text-sm font-medium transition-colors ${
              activeState === tab.value
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Disputes table */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            {activeState === 'open'
              ? 'Open Disputes'
              : activeState === 'in_review'
                ? 'In Review'
                : 'Resolved Disputes'}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-10 rounded-md bg-slate-100 animate-pulse"
                />
              ))}
            </div>
          ) : error ? (
            <div className="py-8 px-4 text-sm text-red-600">{error}</div>
          ) : disputes.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No {activeState.replace('_', ' ')} disputes.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Dispute Reason</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Conversion Event</TableHead>
                  {activeState === 'open' && (
                    <TableHead className="text-right">Actions</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {disputes.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="text-sm max-w-xs truncate">
                      {d.dispute_reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATE_BADGE[d.state]}>
                        {d.state.replace('_', ' ')}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatDate(d.created_at)}
                    </TableCell>
                    <TableCell>
                      <Link
                        href={`/attribution/${d.conversion_event_id}`}
                        className="text-xs text-blue-600 hover:underline font-mono"
                      >
                        {d.conversion_event_id.slice(0, 8)}…
                      </Link>
                    </TableCell>
                    {activeState === 'open' && (
                      <TableCell className="text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={markingId === d.id}
                          onClick={() => void handleMarkInReview(d.id)}
                        >
                          {markingId === d.id ? 'Updating…' : 'Mark In Review'}
                        </Button>
                      </TableCell>
                    )}
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
