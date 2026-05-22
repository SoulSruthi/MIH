'use client';

import { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, ExternalLink, RefreshCw, Users, Zap, ChevronRight } from 'lucide-react';
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
import { useOrgId } from '@/lib/use-org-id';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingSubscription = {
  id: string;
  organization_id: string;
  stripe_customer_id: string;
  stripe_subscription_id: string | null;
  plan_id: string;
  status: 'active' | 'past_due' | 'cancelled' | 'suspended';
  seat_count: number;
  handoff_lead_count: number;
  current_period_start: string | null;
  current_period_end: string | null;
  grace_period_ends_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
};

type BillingInvoice = {
  id: string;
  stripe_invoice_id: string;
  amount_paise: number;
  currency: string;
  status: 'draft' | 'open' | 'paid' | 'uncollectible' | 'void';
  invoice_url: string | null;
  period_start: string | null;
  created_at: string;
};

type BillingUsage = {
  seats: number;
  handoff_leads: number;
  free_tier_leads_remaining: number;
};

type BillingResponse = {
  subscription: BillingSubscription | null;
  invoices: BillingInvoice[];
  usage: BillingUsage;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatCurrency(amountPaise: number, currency: string): string {
  const amount = amountPaise / 100;
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency === 'INR' ? 'INR' : currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

function daysUntil(iso: string): number {
  return Math.ceil((new Date(iso).getTime() - Date.now()) / 86_400_000);
}

function InvoiceStatusBadge({ status }: { status: BillingInvoice['status'] }) {
  switch (status) {
    case 'paid':
      return <Badge variant="success">Paid</Badge>;
    case 'open':
      return <Badge variant="warning">Open</Badge>;
    case 'draft':
      return <Badge variant="ghost">Draft</Badge>;
    case 'uncollectible':
    case 'void':
      return <Badge variant="destructive">{status}</Badge>;
    default:
      return <Badge variant="ghost">{status}</Badge>;
  }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function PastDueBanner({ gracePeriodEndsAt }: { gracePeriodEndsAt: string | null }) {
  const days = gracePeriodEndsAt ? daysUntil(gracePeriodEndsAt) : null;

  return (
    <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 mb-6">
      <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-amber-800">Payment Failed</p>
        <p className="text-sm text-amber-700 mt-0.5">
          {days !== null && days > 0
            ? `Your account will be suspended in ${days} day${days === 1 ? '' : 's'} unless payment is updated.`
            : 'Your account is at risk of suspension. Please update your payment method.'}
        </p>
      </div>
    </div>
  );
}

function SuspendedBanner() {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-4 mb-6">
      <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-red-800">Account Suspended</p>
        <p className="text-sm text-red-700 mt-0.5">
          Your account has been suspended due to a billing issue. Please contact support or update
          your payment method to reactivate.
        </p>
      </div>
    </div>
  );
}

type PlanCardProps = {
  subscription: BillingSubscription | null;
};

function PlanCard({ subscription }: PlanCardProps) {
  const planLabel = subscription ? subscription.plan_id.toUpperCase() : 'FREE TIER';
  const isFreeTier = !subscription || subscription.plan_id === 'free';

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">Current Plan</CardTitle>
          {subscription && (
            <Badge
              variant={
                subscription.status === 'active'
                  ? 'success'
                  : subscription.status === 'past_due'
                    ? 'warning'
                    : 'destructive'
              }
            >
              {subscription.status.replace('_', ' ')}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-slate-900">{planLabel}</p>
            {subscription?.current_period_end && (
              <p className="text-sm text-slate-500 mt-1">
                Renews {formatDate(subscription.current_period_end)}
              </p>
            )}
            {isFreeTier && (
              <p className="text-sm text-slate-500 mt-1">Up to 200 handoff leads included</p>
            )}
          </div>
          {isFreeTier && (
            <Button className="gap-1.5" onClick={() => alert('Stripe Checkout — coming soon')}>
              Upgrade
              <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

type UsageCardProps = {
  usage: BillingUsage;
};

function UsageCard({ usage }: UsageCardProps) {
  const usedLeads = 200 - usage.free_tier_leads_remaining;
  const pct = Math.min(100, Math.round((usedLeads / 200) * 100));
  const barColor = pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Seats */}
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 border border-blue-100">
            <Users className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">{usage.seats} seat{usage.seats === 1 ? '' : 's'}</p>
            <p className="text-xs text-slate-500">Active team members</p>
          </div>
        </div>

        {/* Handoff leads with progress bar */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-50 border border-emerald-100 flex-shrink-0">
            <Zap className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <p className="text-sm font-medium text-slate-800">Handoff Leads</p>
              <span className="text-xs text-slate-500">
                {usedLeads} / 200 (free tier)
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${barColor}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              {usage.free_tier_leads_remaining > 0
                ? `${usage.free_tier_leads_remaining} leads remaining on free tier`
                : 'Free tier limit reached — upgrade to continue'}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

type InvoicesCardProps = {
  invoices: BillingInvoice[];
};

function InvoicesCard({ invoices }: InvoicesCardProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Recent Invoices</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        {invoices.length === 0 ? (
          <div className="px-6 py-8 text-center text-sm text-slate-500">No invoices yet.</div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Date</TableHead>
                <TableHead>Period</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => (
                <TableRow key={inv.id}>
                  <TableCell className="text-sm text-slate-700 whitespace-nowrap">
                    {formatDate(inv.created_at)}
                  </TableCell>
                  <TableCell className="text-sm text-slate-600">
                    {inv.period_start ? formatDate(inv.period_start) : '—'}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium text-slate-900">
                    {formatCurrency(inv.amount_paise, inv.currency)}
                  </TableCell>
                  <TableCell>
                    <InvoiceStatusBadge status={inv.status} />
                  </TableCell>
                  <TableCell>
                    {inv.invoice_url ? (
                      <a
                        href={inv.invoice_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                      >
                        Download
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    ) : (
                      <span className="text-xs text-slate-400">—</span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

// ─── BillingDashboard ─────────────────────────────────────────────────────────

export function BillingDashboard() {
  const [data, setData] = useState<BillingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBilling = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing', {
        headers: { 'x-org-id': 'demo-org-id' },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as BillingResponse;
      setData(json);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load billing data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchBilling();
  }, [fetchBilling]);

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-slate-500">Loading billing data…</div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
        <Button variant="ghost" size="sm" className="ml-3" onClick={() => void fetchBilling()}>
          <RefreshCw className="h-3.5 w-3.5 mr-1" />
          Retry
        </Button>
      </div>
    );
  }

  if (!data) return null;

  const { subscription, invoices, usage } = data;

  return (
    <div className="space-y-6">
      {/* Status banners */}
      {subscription?.status === 'suspended' && <SuspendedBanner />}
      {subscription?.status === 'past_due' && (
        <PastDueBanner gracePeriodEndsAt={subscription.grace_period_ends_at} />
      )}

      {/* Plan + Usage side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <PlanCard subscription={subscription} />
        <UsageCard usage={usage} />
      </div>

      {/* Invoices */}
      <InvoicesCard invoices={invoices} />
    </div>
  );
}
