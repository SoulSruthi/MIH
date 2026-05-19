-- =================================================================
-- Migration: 011_demo_seed
-- Purpose: Insert demo organizations, users, and mock data for evaluation
-- Rule: ADDITIVE ONLY — uses ON CONFLICT DO NOTHING throughout
-- =================================================================

-- -----------------------------------------------------------------
-- 1. Organizations
-- -----------------------------------------------------------------
INSERT INTO organizations (id, name, slug, tier, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Prestige Realty',    'prestige-realty',    'standard',   'active'),
  ('00000000-0000-0000-0000-000000000002', 'Godrej Properties',  'godrej-properties',  'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------
-- 2. Demo users in auth.users
--    IDs: 10000000-0000-0000-0000-00000000000X  (1–7)
--    Password for all: demo@mih@2026
-- -----------------------------------------------------------------

INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  -- 1. super admin
  (
    '10000000-0000-0000-0000-000000000001',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'superadmin@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Super Admin"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 2. org admin prestige
  (
    '10000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'orgadmin1@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Org Admin (Prestige)"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 3. org admin godrej
  (
    '10000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'orgadmin2@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Org Admin (Godrej)"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 4. marketing manager
  (
    '10000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'manager@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Marketing Manager"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 5. marketing analyst
  (
    '10000000-0000-0000-0000-000000000005',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'analyst@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Marketing Analyst"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 6. marketing ops
  (
    '10000000-0000-0000-0000-000000000006',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'ops@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Marketing Ops"}'::jsonb,
    false, '', '', '', ''
  ),
  -- 7. viewer
  (
    '10000000-0000-0000-0000-000000000007',
    '00000000-0000-0000-0000-000000000000',
    'authenticated', 'authenticated',
    'viewer@demo.mih',
    crypt('demo@mih@2026', gen_salt('bf')),
    NOW(), NOW(), NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{"full_name":"Org Viewer"}'::jsonb,
    false, '', '', '', ''
  )
ON CONFLICT (id) DO NOTHING;

-- auth.identities rows (required for email login)
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
)
VALUES
  (
    '10000000-0000-0000-0000-000000000001',
    '10000000-0000-0000-0000-000000000001',
    '{"sub":"10000000-0000-0000-0000-000000000001","email":"superadmin@demo.mih"}'::jsonb,
    'email', 'superadmin@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    '10000000-0000-0000-0000-000000000002',
    '{"sub":"10000000-0000-0000-0000-000000000002","email":"orgadmin1@demo.mih"}'::jsonb,
    'email', 'orgadmin1@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    '10000000-0000-0000-0000-000000000003',
    '{"sub":"10000000-0000-0000-0000-000000000003","email":"orgadmin2@demo.mih"}'::jsonb,
    'email', 'orgadmin2@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000004',
    '10000000-0000-0000-0000-000000000004',
    '{"sub":"10000000-0000-0000-0000-000000000004","email":"manager@demo.mih"}'::jsonb,
    'email', 'manager@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000005',
    '10000000-0000-0000-0000-000000000005',
    '{"sub":"10000000-0000-0000-0000-000000000005","email":"analyst@demo.mih"}'::jsonb,
    'email', 'analyst@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000006',
    '10000000-0000-0000-0000-000000000006',
    '{"sub":"10000000-0000-0000-0000-000000000006","email":"ops@demo.mih"}'::jsonb,
    'email', 'ops@demo.mih', NOW(), NOW(), NOW()
  ),
  (
    '10000000-0000-0000-0000-000000000007',
    '10000000-0000-0000-0000-000000000007',
    '{"sub":"10000000-0000-0000-0000-000000000007","email":"viewer@demo.mih"}'::jsonb,
    'email', 'viewer@demo.mih', NOW(), NOW(), NOW()
  )
ON CONFLICT (provider, provider_id) DO NOTHING;

-- -----------------------------------------------------------------
-- 3. Memberships
--    base_role: 'org_user' for all (super_admin has no org)
--    app_roles: role array per migration 001 schema
-- -----------------------------------------------------------------
INSERT INTO memberships (organization_id, user_id, base_role, app_roles, status)
VALUES
  -- orgadmin1 → Prestige Realty
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'org_user', ARRAY['mih_org_admin'], 'active'),
  -- orgadmin2 → Godrej Properties
  ('00000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000003', 'org_user', ARRAY['mih_org_admin'], 'active'),
  -- manager → Prestige Realty
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'org_user', ARRAY['marketing_manager'], 'active'),
  -- analyst → Prestige Realty
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000005', 'org_user', ARRAY['marketing_analyst'], 'active'),
  -- ops → Prestige Realty
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000006', 'org_user', ARRAY['marketing_ops'], 'active'),
  -- viewer → Prestige Realty
  ('00000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000007', 'org_user', ARRAY['org_viewer'], 'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- -----------------------------------------------------------------
-- 4. Dedup rules defaults for both orgs
-- -----------------------------------------------------------------
INSERT INTO dedup_rules (organization_id, phone_window_hours, email_dedup_enabled, fuzzy_phone_enabled, post_window_behavior)
VALUES
  ('00000000-0000-0000-0000-000000000001', 24, false, true, 'new_lead'),
  ('00000000-0000-0000-0000-000000000002', 24, false, true, 'new_lead')
ON CONFLICT (organization_id) DO NOTHING;

-- -----------------------------------------------------------------
-- 5. Sources
-- -----------------------------------------------------------------
INSERT INTO sources (id, organization_id, source_kind, display_name, state)
VALUES
  -- Prestige Realty sources
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'meta_lead_ads',   'Meta Lead Ads',      'active'),
  ('20000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '99acres',         '99acres Listings',   'active'),
  ('20000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'google_ads',      'Google Search Ads',  'active'),
  -- Godrej Properties sources
  ('20000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000002', 'meta_lead_ads',   'Meta Lead Ads',      'active'),
  ('20000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'magicbricks',     'MagicBricks',        'active')
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------
-- 6. Identity clusters (one per unique lead — required FK)
-- -----------------------------------------------------------------
INSERT INTO identity_clusters (id, organization_id, cluster_confidence)
VALUES
  -- Prestige Realty clusters (10 leads)
  ('30000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', 1.0),
  ('30000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', 1.0),
  -- Godrej clusters (10 leads)
  ('30000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000002', 1.0),
  ('30000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', 1.0)
ON CONFLICT (id) DO NOTHING;

-- -----------------------------------------------------------------
-- 7. Unique leads — Prestige Realty (10 leads)
-- -----------------------------------------------------------------
INSERT INTO unique_leads (
  id, organization_id, identity_cluster_id,
  primary_phone_e164, primary_name,
  first_seen_at, last_seen_at,
  primary_source_id, total_touches, touch_sources,
  crm_handoff_status
)
VALUES
  ('40000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000001',
   '+919876543001', 'Amit Sharma',
   NOW() - INTERVAL '25 days', NOW() - INTERVAL '25 days',
   '20000000-0000-0000-0000-000000000001', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000002',
   '+919876543002', 'Priya Nair',
   NOW() - INTERVAL '22 days', NOW() - INTERVAL '20 days',
   '20000000-0000-0000-0000-000000000002', 2, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000003',
   '+919876543003', 'Rahul Verma',
   NOW() - INTERVAL '20 days', NOW() - INTERVAL '18 days',
   '20000000-0000-0000-0000-000000000001', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000004',
   '+919876543004', 'Sunita Reddy',
   NOW() - INTERVAL '18 days', NOW() - INTERVAL '15 days',
   '20000000-0000-0000-0000-000000000003', 1, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000005',
   '+919876543005', 'Vikram Singh',
   NOW() - INTERVAL '15 days', NOW() - INTERVAL '14 days',
   '20000000-0000-0000-0000-000000000001', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000006',
   '+919876543006', 'Meena Iyer',
   NOW() - INTERVAL '12 days', NOW() - INTERVAL '10 days',
   '20000000-0000-0000-0000-000000000002', 2, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000007',
   '+919876543007', 'Anand Kumar',
   NOW() - INTERVAL '10 days', NOW() - INTERVAL '9 days',
   '20000000-0000-0000-0000-000000000003', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000008',
   '+919876543008', 'Kavitha Rao',
   NOW() - INTERVAL '7 days', NOW() - INTERVAL '6 days',
   '20000000-0000-0000-0000-000000000001', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000009',
   '+919876543009', 'Deepak Joshi',
   NOW() - INTERVAL '4 days', NOW() - INTERVAL '3 days',
   '20000000-0000-0000-0000-000000000002', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000010', '00000000-0000-0000-0000-000000000001', '30000000-0000-0000-0000-000000000010',
   '+919876543010', 'Lakshmi Pillai',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
   '20000000-0000-0000-0000-000000000003', 1, '[]', 'pending')
ON CONFLICT (organization_id, primary_phone_e164) DO NOTHING;

-- -----------------------------------------------------------------
-- 8. Unique leads — Godrej Properties (10 leads)
-- -----------------------------------------------------------------
INSERT INTO unique_leads (
  id, organization_id, identity_cluster_id,
  primary_phone_e164, primary_name,
  first_seen_at, last_seen_at,
  primary_source_id, total_touches, touch_sources,
  crm_handoff_status
)
VALUES
  ('40000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000011',
   '+919876543011', 'Rohan Mehta',
   NOW() - INTERVAL '28 days', NOW() - INTERVAL '27 days',
   '20000000-0000-0000-0000-000000000004', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000012',
   '+919876543012', 'Anjali Desai',
   NOW() - INTERVAL '24 days', NOW() - INTERVAL '22 days',
   '20000000-0000-0000-0000-000000000005', 2, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000013',
   '+919876543013', 'Suresh Patel',
   NOW() - INTERVAL '21 days', NOW() - INTERVAL '20 days',
   '20000000-0000-0000-0000-000000000004', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000014', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000014',
   '+919876543014', 'Nalini Krishnan',
   NOW() - INTERVAL '17 days', NOW() - INTERVAL '16 days',
   '20000000-0000-0000-0000-000000000005', 1, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000015', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000015',
   '+919876543015', 'Kiran Bhatia',
   NOW() - INTERVAL '14 days', NOW() - INTERVAL '13 days',
   '20000000-0000-0000-0000-000000000004', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000016', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000016',
   '+919876543016', 'Shalini Gupta',
   NOW() - INTERVAL '11 days', NOW() - INTERVAL '10 days',
   '20000000-0000-0000-0000-000000000005', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000017', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000017',
   '+919876543017', 'Prakash Nair',
   NOW() - INTERVAL '8 days', NOW() - INTERVAL '7 days',
   '20000000-0000-0000-0000-000000000004', 2, '[]', 'succeeded'),

  ('40000000-0000-0000-0000-000000000018', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000018',
   '+919876543018', 'Rekha Iyer',
   NOW() - INTERVAL '5 days', NOW() - INTERVAL '4 days',
   '20000000-0000-0000-0000-000000000005', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000019', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000019',
   '+919876543019', 'Vivek Sharma',
   NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days',
   '20000000-0000-0000-0000-000000000004', 1, '[]', 'pending'),

  ('40000000-0000-0000-0000-000000000020', '00000000-0000-0000-0000-000000000002', '30000000-0000-0000-0000-000000000020',
   '+919876543020', 'Pooja Verma',
   NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day',
   '20000000-0000-0000-0000-000000000005', 1, '[]', 'pending')
ON CONFLICT (organization_id, primary_phone_e164) DO NOTHING;

-- -----------------------------------------------------------------
-- 9. Spend data — 30 days for Prestige Realty sources
-- -----------------------------------------------------------------

-- Meta Lead Ads spend (Prestige)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise, data_source)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  d::date,
  -- 10,000–60,000 paise (100–600 INR/day)
  (10000 + floor(random() * 50000))::bigint,
  'manual'
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) d
ON CONFLICT DO NOTHING;

-- 99acres spend (Prestige)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise, data_source)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  d::date,
  (5000 + floor(random() * 20000))::bigint,
  'manual'
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) d
ON CONFLICT DO NOTHING;

-- Google Search Ads spend (Prestige)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise, data_source)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000003',
  d::date,
  (8000 + floor(random() * 40000))::bigint,
  'manual'
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) d
ON CONFLICT DO NOTHING;

-- Meta Lead Ads spend (Godrej)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise, data_source)
SELECT
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000004',
  d::date,
  (15000 + floor(random() * 70000))::bigint,
  'manual'
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) d
ON CONFLICT DO NOTHING;

-- MagicBricks spend (Godrej)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise, data_source)
SELECT
  '00000000-0000-0000-0000-000000000002',
  '20000000-0000-0000-0000-000000000005',
  d::date,
  (6000 + floor(random() * 25000))::bigint,
  'manual'
FROM generate_series(
  CURRENT_DATE - INTERVAL '30 days',
  CURRENT_DATE - INTERVAL '1 day',
  '1 day'::interval
) d
ON CONFLICT DO NOTHING;

-- -----------------------------------------------------------------
-- 10. Attribution rollups — last 30 days for Prestige sources
-- -----------------------------------------------------------------
INSERT INTO attribution_rollups (
  organization_id, source_id, rollup_date, model_version,
  unique_lead_count, contacted_count, qualified_count, site_visit_count, deal_count, won_count,
  won_value_paise, spend_paise,
  cpl_paise, cpa_paise, roas_times_100
)
SELECT
  '00000000-0000-0000-0000-000000000001',
  source_id,
  d::date,
  'last_touch_v1',
  -- lead counts
  (1 + floor(random() * 5))::integer,
  (floor(random() * 3))::integer,
  (floor(random() * 2))::integer,
  (floor(random() * 1))::integer,
  (CASE WHEN random() > 0.85 THEN 1 ELSE 0 END)::integer,
  (CASE WHEN random() > 0.95 THEN 1 ELSE 0 END)::integer,
  -- won value
  (CASE WHEN random() > 0.95 THEN (500000000 + floor(random() * 500000000))::bigint ELSE 0 END),
  -- spend (roughly 10000–50000 paise/day)
  (10000 + floor(random() * 40000))::bigint,
  -- cpl: spend / leads
  ((10000 + floor(random() * 40000)) / (1 + floor(random() * 5)))::bigint,
  NULL, NULL
FROM
  (VALUES
    ('20000000-0000-0000-0000-000000000001'::uuid),
    ('20000000-0000-0000-0000-000000000002'::uuid),
    ('20000000-0000-0000-0000-000000000003'::uuid)
  ) AS s(source_id),
  generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::interval
  ) d
ON CONFLICT (organization_id, source_id, rollup_date, model_version) DO NOTHING;

-- Attribution rollups for Godrej sources
INSERT INTO attribution_rollups (
  organization_id, source_id, rollup_date, model_version,
  unique_lead_count, contacted_count, qualified_count, site_visit_count, deal_count, won_count,
  won_value_paise, spend_paise,
  cpl_paise, cpa_paise, roas_times_100
)
SELECT
  '00000000-0000-0000-0000-000000000002',
  source_id,
  d::date,
  'last_touch_v1',
  (1 + floor(random() * 7))::integer,
  (floor(random() * 4))::integer,
  (floor(random() * 2))::integer,
  (floor(random() * 1))::integer,
  (CASE WHEN random() > 0.88 THEN 1 ELSE 0 END)::integer,
  (CASE WHEN random() > 0.96 THEN 1 ELSE 0 END)::integer,
  (CASE WHEN random() > 0.96 THEN (800000000 + floor(random() * 700000000))::bigint ELSE 0 END),
  (15000 + floor(random() * 55000))::bigint,
  ((15000 + floor(random() * 55000)) / (1 + floor(random() * 7)))::bigint,
  NULL, NULL
FROM
  (VALUES
    ('20000000-0000-0000-0000-000000000004'::uuid),
    ('20000000-0000-0000-0000-000000000005'::uuid)
  ) AS s(source_id),
  generate_series(
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE - INTERVAL '1 day',
    '1 day'::interval
  ) d
ON CONFLICT (organization_id, source_id, rollup_date, model_version) DO NOTHING;

-- =================================================================
-- END OF DEMO SEED
-- =================================================================
