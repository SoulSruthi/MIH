'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Phone,
  Star,
  MapPin,
  TrendingUp,
  Trophy,
  XCircle,
  User,
  ArrowLeft,
} from 'lucide-react';
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

// --- Types ---

type RawLead = {
  id: string;
  name: string;
  phone_e164: string;
  email: string | null;
  source: { id: string; name: string; source_type: string } | null;
  source_campaign_name: string | null;
  ingested_at: string;
  dedup_status: string;
  dedup_reason: string | null;
};

type CrmEvent = {
  id: string;
  event_type: string;
  event_at: string;
  deal_value_paise: number | null;
  source: { id: string; name: string } | null;
};

type LeadDetail = {
  id: string;
  primary_name: string;
  known_names: string[];
  primary_phone_e164: string;
  primary_email: string | null;
  total_touches: number;
  first_seen_at: string;
  last_seen_at: string;
  crm_handoff_status: string;
  primary_source: { id: string; name: string; source_type: string } | null;
  raw_leads: RawLead[];
  crm_events: CrmEvent[];
};

// --- Helpers ---

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatInr(paise: number): string {
  return '₹' + Math.round(paise / 100).toLocaleString('en-IN');
}

// --- Sub-components ---

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

function DedupStatusBadge({ status }: { status: string }) {
  switch (status) {
    case 'unique':
      return <Badge variant="info">Unique</Badge>;
    case 'duplicate':
      return <Badge variant="warning">Duplicate</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function CrmEventIcon({ eventType }: { eventType: string }) {
  const cls = 'h-4 w-4 shrink-0';
  switch (eventType) {
    case 'contacted':
      return <Phone className={`${cls} text-blue-500`} />;
    case 'qualified':
      return <Star className={`${cls} text-violet-500`} />;
    case 'site_visit':
      return <MapPin className={`${cls} text-indigo-500`} />;
    case 'deal':
      return <TrendingUp className={`${cls} text-purple-500`} />;
    case 'won':
      return <Trophy className={`${cls} text-emerald-500`} />;
    case 'lost':
      return <XCircle className={`${cls} text-red-500`} />;
    default:
      return <User className={`${cls} text-slate-400`} />;
  }
}

function eventTypeLabel(eventType: string): string {
  switch (eventType) {
    case 'contacted':
      return 'Contacted';
    case 'qualified':
      return 'Qualified';
    case 'site_visit':
      return 'Site Visit';
    case 'deal':
      return 'Deal';
    case 'won':
      return 'Won';
    case 'lost':
      return 'Lost';
    default:
      return eventType.replace(/_/g, ' ');
  }
}

function KnownNamesChips({
  names,
  primaryName,
}: {
  names: string[];
  primaryName: string;
}) {
  const [open, setOpen] = useState(false);
  const extras = names.filter((n) => n !== primaryName);
  if (extras.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center"
      >
        <Badge variant="secondary" className="cursor-pointer text-[10px] px-1.5 py-0">
          +{extras.length} alias{extras.length > 1 ? 'es' : ''}
        </Badge>
      </button>
      {open && (
        <div className="mt-2 flex flex-wrap gap-1">
          {extras.map((name) => (
            <span
              key={name}
              className="inline-block rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
            >
              {name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// --- Lead History Table ---

function LeadHistoryTable({ rawLeads }: { rawLeads: RawLead[] }) {
  if (rawLeads.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">No raw lead records.</div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow className="hover:bg-transparent">
          <TableHead>Source</TableHead>
          <TableHead>Campaign</TableHead>
          <TableHead>Phone</TableHead>
          <TableHead>Date</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Dedup Reason</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rawLeads.map((r) => (
          <TableRow key={r.id}>
            <TableCell>
              {r.source ? (
                <div>
                  <span className="text-sm font-medium text-slate-800">{r.source.name}</span>
                  <div className="text-xs text-slate-500 capitalize">
                    {r.source.source_type.replace(/_/g, ' ')}
                  </div>
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </TableCell>
            <TableCell className="text-sm text-slate-600">
              {r.source_campaign_name ?? <span className="text-slate-400">—</span>}
            </TableCell>
            <TableCell className="font-mono text-sm text-slate-700">{r.phone_e164}</TableCell>
            <TableCell className="whitespace-nowrap text-sm text-slate-600">
              {formatDate(r.ingested_at)}
            </TableCell>
            <TableCell>
              <DedupStatusBadge status={r.dedup_status} />
            </TableCell>
            <TableCell className="max-w-[200px] text-xs text-slate-500">
              {r.dedup_reason ?? <span className="text-slate-300">—</span>}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

// --- CRM Timeline ---

function CrmTimeline({ events }: { events: CrmEvent[] }) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-slate-500">No CRM events yet.</div>
    );
  }

  return (
    <ol className="relative ml-4 border-l border-slate-200">
      {events.map((ev, idx) => (
        <li key={ev.id} className={`ml-6 ${idx < events.length - 1 ? 'pb-6' : ''}`}>
          {/* Icon bubble */}
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-white ring-2 ring-slate-200">
            <CrmEventIcon eventType={ev.event_type} />
          </span>

          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-900">
                {eventTypeLabel(ev.event_type)}
              </span>
              {ev.deal_value_paise !== null && ev.deal_value_paise > 0 && (
                <Badge variant="success">{formatInr(ev.deal_value_paise)}</Badge>
              )}
            </div>
            <time className="text-xs text-slate-500">{formatDate(ev.event_at)}</time>
            {ev.source && (
              <span className="text-xs text-slate-400">via {ev.source.name}</span>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

// --- Main Component ---

type Props = {
  leadId: string;
};

export function LeadDetailPanel({ leadId }: Props) {
  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    fetch(`/api/leads/${leadId}`, {
      headers: { 'x-org-id': 'demo-org-id' },
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = (await res.json().catch(() => ({}))) as { error?: string };
          throw new Error(body.error ?? `HTTP ${res.status}`);
        }
        return res.json() as Promise<LeadDetail>;
      })
      .then((data) => {
        if (!cancelled) setLead(data);
      })
      .catch((err: unknown) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : 'Failed to load lead');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (loading) {
    return (
      <div className="py-20 text-center text-sm text-slate-500">Loading lead details…</div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Link
          href="/leads"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Leads
        </Link>
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      </div>
    );
  }

  if (!lead) return null;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link
        href="/leads"
        className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Leads
      </Link>

      {/* Header card */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold text-slate-900">{lead.primary_name}</h1>
              <KnownNamesChips names={lead.known_names} primaryName={lead.primary_name} />
              <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-600">
                <span className="font-mono">{lead.primary_phone_e164}</span>
                {lead.primary_email && <span>{lead.primary_email}</span>}
              </div>
              {lead.primary_source && (
                <div className="mt-1 text-xs text-slate-500 capitalize">
                  Primary source:{' '}
                  <span className="font-medium text-slate-700">{lead.primary_source.name}</span>
                  {' '}({lead.primary_source.source_type.replace(/_/g, ' ')})
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="font-mono">
                {lead.total_touches} touch{lead.total_touches !== 1 ? 'es' : ''}
              </Badge>
              <CrmStatusBadge status={lead.crm_handoff_status} />
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-4">
            <div>
              <p className="text-xs text-slate-500">First Seen</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">
                {formatDate(lead.first_seen_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Last Seen</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">
                {formatDate(lead.last_seen_at)}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Raw Touches</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">
                {lead.raw_leads.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-slate-500">CRM Events</p>
              <p className="mt-0.5 text-sm font-medium text-slate-800">
                {lead.crm_events.length}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lead History */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Lead History</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <LeadHistoryTable rawLeads={lead.raw_leads} />
        </CardContent>
      </Card>

      {/* CRM Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">CRM Timeline</CardTitle>
        </CardHeader>
        <CardContent className="pt-4 pb-6">
          <CrmTimeline events={lead.crm_events} />
        </CardContent>
      </Card>
    </div>
  );
}
