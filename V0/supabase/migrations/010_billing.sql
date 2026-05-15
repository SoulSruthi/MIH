BEGIN;

CREATE TABLE IF NOT EXISTS billing_subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_customer_id text NOT NULL,
  stripe_subscription_id text,
  plan_id text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'past_due', 'cancelled', 'suspended')),
  seat_count integer NOT NULL DEFAULT 0,
  handoff_lead_count integer NOT NULL DEFAULT 0,
  current_period_start timestamptz,
  current_period_end timestamptz,
  grace_period_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(organization_id),
  UNIQUE(stripe_customer_id)
);

ALTER TABLE billing_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_subscriptions_org_isolation" ON billing_subscriptions
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

CREATE TABLE IF NOT EXISTS billing_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  stripe_invoice_id text NOT NULL UNIQUE,
  amount_paise bigint NOT NULL,
  currency text NOT NULL DEFAULT 'INR',
  status text NOT NULL CHECK (status IN ('draft', 'open', 'paid', 'uncollectible', 'void')),
  invoice_url text,
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE billing_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "billing_invoices_org_isolation" ON billing_invoices
  USING (organization_id = public.app_org_id())
  WITH CHECK (organization_id = public.app_org_id());

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_org ON billing_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_invoices_org ON billing_invoices(organization_id);

COMMIT;
