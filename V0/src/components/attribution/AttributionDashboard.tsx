'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useOrgId } from '@/lib/use-org-id';

type ConversionEvent = {
  id: string;
  event_code: string;
  occurred_at: string;
  cluster_id: string | null;
};

type DisputedItem = {
  id: string;
  state: string;
};

export function AttributionDashboard() {
  const orgId = useOrgId();
  const [events, setEvents] = useState<ConversionEvent[]>([]);
  const [disputed, setDisputed] = useState<DisputedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [eventsRes, disputedRes] = await Promise.all([
        fetch('/api/attribution/conversion-events?limit=20', {
          headers: { 'x-org-id': orgId },
        }),
        fetch('/api/attribution/disputed?state=open', {
          headers: { 'x-org-id': orgId },
        }),
      ]);

      if (eventsRes.ok) {
        const d = (await eventsRes.json()) as
          | ConversionEvent[]
          | { events: ConversionEvent[] };
        setEvents(Array.isArray(d) ? d : (d.events ?? []));
      }

      if (disputedRes.ok) {
        const d = (await disputedRes.json()) as
          | DisputedItem[]
          | { disputes: DisputedItem[] };
        setDisputed(Array.isArray(d) ? d : (d.disputes ?? []));
      }
    } catch {
      setError('Failed to load attribution data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Total Conversions
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? (
              <div className="h-8 w-16 rounded-md bg-slate-100 animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-slate-900">{events.length}</p>
            )}
            <p className="text-xs text-slate-400 mt-1">last 20 events</p>
          </CardContent>
        </Card>

        <Card className="rounded-xl shadow-sm border-slate-200">
          <CardHeader className="pb-2 pt-5 px-5">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Open Disputes
            </CardTitle>
          </CardHeader>
          <CardContent className="px-5 pb-5">
            {loading ? (
              <div className="h-8 w-16 rounded-md bg-slate-100 animate-pulse" />
            ) : (
              <p className="text-3xl font-bold text-slate-900">{disputed.length}</p>
            )}
            <Link
              href="/attribution/disputed"
              className="text-xs text-blue-600 hover:underline mt-1 inline-block"
            >
              View disputed queue →
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Disputed attributions badge */}
      {!loading && disputed.length > 0 && (
        <div className="flex items-center gap-2">
          <Badge variant="destructive">
            {disputed.length} open dispute{disputed.length !== 1 ? 's' : ''}
          </Badge>
          <Link
            href="/attribution/disputed"
            className="text-sm text-blue-600 hover:underline"
          >
            Go to Disputed Attributions →
          </Link>
        </div>
      )}

      {/* Recent conversion events table */}
      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">
            Recent Conversion Events
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-2 p-4">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-10 rounded-md bg-slate-100 animate-pulse" />
              ))}
            </div>
          ) : events.length === 0 ? (
            <div className="py-12 text-center text-slate-400 text-sm">
              No conversion events yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Event Code</TableHead>
                  <TableHead>Occurred At</TableHead>
                  <TableHead>Cluster</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {events.map((ev) => (
                  <TableRow key={ev.id}>
                    <TableCell className="font-mono text-sm">{ev.event_code}</TableCell>
                    <TableCell className="text-sm text-slate-600">
                      {formatDate(ev.occurred_at)}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-slate-500">
                      {ev.cluster_id
                        ? `${ev.cluster_id.slice(0, 8)}…`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link
                        href={`/attribution/${ev.id}`}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Explain
                      </Link>
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
