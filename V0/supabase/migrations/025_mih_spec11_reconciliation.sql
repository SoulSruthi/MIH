-- Spec 11: Reconciliation & SF Import

CREATE TABLE IF NOT EXISTS mih.reconciliation_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  item_type text NOT NULL CHECK (item_type IN (
    'disputed_cp_credit','disputed_referral_credit','manual_call_no_tracking',
    'unmatched_walk_in','comment_source_override','telecaller_claim_audit',
    'sales_rep_unattended_lead','low_conf_identity_merge',
    'source_disabled_violation','orphan_spend_investigation'
  )),
  state text NOT NULL DEFAULT 'open' CHECK (state IN ('open','in_review','resolved','escalated','closed','expired')),
  severity text NOT NULL DEFAULT 'normal' CHECK (severity IN ('low','normal','high','critical')),
  monetary_impact bigint,
  cluster_id uuid REFERENCES mih.identity_clusters(id),
  origin_event_id text,
  sla_deadline_at timestamptz,
  assigned_to uuid REFERENCES auth.users(id),
  context jsonb NOT NULL DEFAULT '{}',
  resolution text,
  resolution_actions jsonb,
  resolved_by uuid REFERENCES auth.users(id),
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (org_id, item_type, cluster_id, origin_event_id)
);

CREATE TABLE IF NOT EXISTS mih.reconciliation_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  item_id uuid NOT NULL REFERENCES mih.reconciliation_items(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('state_change','note_added','assigned','evidence_attached','resolution_set')),
  actor_id uuid REFERENCES auth.users(id),
  old_value jsonb,
  new_value jsonb,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.sf_import_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  job_kind text NOT NULL CHECK (job_kind IN ('leads','contacts','opportunities','calls','comments','full_export')),
  state text NOT NULL DEFAULT 'pending' CHECK (state IN ('pending','running','completed','failed','partial')),
  mapping_config jsonb NOT NULL DEFAULT '{}',
  total_rows integer,
  processed_rows integer NOT NULL DEFAULT 0,
  error_rows integer NOT NULL DEFAULT 0,
  backfill boolean NOT NULL DEFAULT false,
  started_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS mih.sf_import_row_errors (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id),
  job_id uuid NOT NULL REFERENCES mih.sf_import_jobs(id) ON DELETE CASCADE,
  row_number integer NOT NULL,
  error_message text NOT NULL,
  raw_row jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE mih.reconciliation_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.reconciliation_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.sf_import_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mih.sf_import_row_errors ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='reconciliation_items' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.reconciliation_items USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='reconciliation_audit' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.reconciliation_audit USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='sf_import_jobs' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.sf_import_jobs USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='mih' AND tablename='sf_import_row_errors' AND policyname='org_isolation') THEN
    CREATE POLICY "org_isolation" ON mih.sf_import_row_errors USING (org_id = (SELECT org_id FROM public.memberships WHERE user_id = auth.uid() LIMIT 1));
  END IF;
END $$;
