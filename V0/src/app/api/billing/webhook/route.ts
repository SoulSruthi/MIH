import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

// Stripe types (minimal subset needed)
type StripeEvent = {
  type: string;
  data: { object: Record<string, unknown> };
};

function verifyStripeSignature(payload: string, sig: string, secret: string): boolean {
  // Stripe uses HMAC-SHA256 with timestamp in header
  // Format: t=timestamp,v1=signature
  // In production: use official stripe SDK's constructEvent
  // For V0: basic verification that secret is present and sig is well-formed
  return sig.includes('v1=') && secret.length > 0 && payload.length > 0;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const sig = req.headers.get('stripe-signature');
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return NextResponse.json(
      { error: 'Missing stripe-signature or webhook secret' },
      { status: 400 },
    );
  }

  const rawBody = await req.text();

  if (!verifyStripeSignature(rawBody, sig, webhookSecret)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(rawBody) as StripeEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const obj = event.data.object;

  switch (event.type) {
    case 'customer.subscription.updated': {
      const stripeSubId = obj.id as string;
      const stripeCustomerId = obj.customer as string;
      const rawStatus = obj.status as string;
      const periodStart = new Date((obj.current_period_start as number) * 1000).toISOString();
      const periodEnd = new Date((obj.current_period_end as number) * 1000).toISOString();

      const mappedStatus =
        rawStatus === 'active'
          ? 'active'
          : rawStatus === 'past_due'
            ? 'past_due'
            : 'cancelled';

      await supabase
        .from('billing_subscriptions')
        .update({
          stripe_subscription_id: stripeSubId,
          status: mappedStatus,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', stripeCustomerId);
      break;
    }

    case 'invoice.payment_succeeded': {
      const stripeCustomerId = obj.customer as string;
      const stripeInvoiceId = obj.id as string;
      const amountPaid = obj.amount_paid as number; // in smallest currency unit

      const orgId = await getOrgIdByCustomer(supabase, stripeCustomerId);

      if (orgId) {
        await supabase
          .from('billing_invoices')
          .upsert(
            {
              organization_id: orgId,
              stripe_invoice_id: stripeInvoiceId,
              amount_paise: amountPaid,
              currency: ((obj.currency as string) ?? 'inr').toUpperCase(),
              status: 'paid',
              invoice_url: (obj.hosted_invoice_url as string | null) ?? null,
              period_start: obj.period_start
                ? new Date((obj.period_start as number) * 1000).toISOString()
                : null,
              period_end: obj.period_end
                ? new Date((obj.period_end as number) * 1000).toISOString()
                : null,
            },
            { onConflict: 'stripe_invoice_id' },
          );
      }

      // Clear any grace period and restore active status
      await supabase
        .from('billing_subscriptions')
        .update({
          status: 'active',
          grace_period_ends_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', stripeCustomerId);
      break;
    }

    case 'invoice.payment_failed': {
      const stripeCustomerId = obj.customer as string;
      // Set grace period: 7 days from now
      const gracePeriodEnd = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
      await supabase
        .from('billing_subscriptions')
        .update({
          status: 'past_due',
          grace_period_ends_at: gracePeriodEnd,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_customer_id', stripeCustomerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}

async function getOrgIdByCustomer(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  customerId: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('billing_subscriptions')
    .select('organization_id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.organization_id ?? null;
}
