-- ================================================================
-- MIH Demo Seed — run this in Supabase SQL Editor
-- Creates 2 demo orgs + 7 users + mock data
-- Password for ALL accounts: demo@mih@2026
-- ================================================================

-- 1. Organizations
INSERT INTO organizations (id, name, slug, tier, status)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'Prestige Realty',   'prestige-realty',   'standard',   'active'),
  ('00000000-0000-0000-0000-000000000002', 'Godrej Properties', 'godrej-properties', 'enterprise', 'active')
ON CONFLICT (id) DO NOTHING;

-- 2. Demo users in auth.users (password: demo@mih@2026)
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data, is_super_admin,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
VALUES
  ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'superadmin@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Super Admin"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'orgadmin1@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Org Admin (Prestige)"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'orgadmin2@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Org Admin (Godrej)"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'manager@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Marketing Manager"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'analyst@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Marketing Analyst"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'ops@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Marketing Ops"}'::jsonb,
   false,'','','',''),
  ('10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000000','authenticated','authenticated',
   'viewer@demo.mih', crypt('demo@mih@2026', gen_salt('bf')),
   NOW(),NOW(),NOW(),'{"provider":"email","providers":["email"]}'::jsonb,'{"full_name":"Org Viewer"}'::jsonb,
   false,'','','','')
ON CONFLICT (id) DO NOTHING;

-- 3. auth.identities (required for email/password login to work)
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
VALUES
  ('10000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000001',
   '{"sub":"10000000-0000-0000-0000-000000000001","email":"superadmin@demo.mih"}'::jsonb,
   'email','superadmin@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000002',
   '{"sub":"10000000-0000-0000-0000-000000000002","email":"orgadmin1@demo.mih"}'::jsonb,
   'email','orgadmin1@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000003','10000000-0000-0000-0000-000000000003',
   '{"sub":"10000000-0000-0000-0000-000000000003","email":"orgadmin2@demo.mih"}'::jsonb,
   'email','orgadmin2@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000004','10000000-0000-0000-0000-000000000004',
   '{"sub":"10000000-0000-0000-0000-000000000004","email":"manager@demo.mih"}'::jsonb,
   'email','manager@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000005','10000000-0000-0000-0000-000000000005',
   '{"sub":"10000000-0000-0000-0000-000000000005","email":"analyst@demo.mih"}'::jsonb,
   'email','analyst@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000006','10000000-0000-0000-0000-000000000006',
   '{"sub":"10000000-0000-0000-0000-000000000006","email":"ops@demo.mih"}'::jsonb,
   'email','ops@demo.mih',NOW(),NOW(),NOW()),
  ('10000000-0000-0000-0000-000000000007','10000000-0000-0000-0000-000000000007',
   '{"sub":"10000000-0000-0000-0000-000000000007","email":"viewer@demo.mih"}'::jsonb,
   'email','viewer@demo.mih',NOW(),NOW(),NOW())
ON CONFLICT (id) DO NOTHING;

-- 4. Memberships
INSERT INTO memberships (organization_id, user_id, base_role, app_roles, status)
VALUES
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000002','org_user',ARRAY['mih_org_admin'],'active'),
  ('00000000-0000-0000-0000-000000000002','10000000-0000-0000-0000-000000000003','org_user',ARRAY['mih_org_admin'],'active'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000004','org_user',ARRAY['marketing_manager'],'active'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000005','org_user',ARRAY['marketing_analyst'],'active'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000006','org_user',ARRAY['marketing_ops'],'active'),
  ('00000000-0000-0000-0000-000000000001','10000000-0000-0000-0000-000000000007','org_user',ARRAY['org_viewer'],'active')
ON CONFLICT (organization_id, user_id) DO NOTHING;

-- 5. Dedup rules
INSERT INTO dedup_rules (organization_id, phone_window_hours, email_dedup_enabled, fuzzy_phone_enabled, post_window_behavior)
VALUES
  ('00000000-0000-0000-0000-000000000001', 24, false, true, 'new_lead'),
  ('00000000-0000-0000-0000-000000000002', 24, false, true, 'new_lead')
ON CONFLICT (organization_id) DO NOTHING;

-- 6. Sources
INSERT INTO sources (id, organization_id, source_kind, display_name, state)
VALUES
  ('20000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','meta_lead_ads','Meta Lead Ads','active'),
  ('20000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','99acres','99acres Listings','active'),
  ('20000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','google_ads','Google Search Ads','active'),
  ('20000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000002','meta_lead_ads','Meta Lead Ads','active'),
  ('20000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000002','magicbricks','MagicBricks','active')
ON CONFLICT (id) DO NOTHING;

-- 7. Identity clusters (required FK for unique_leads)
INSERT INTO identity_clusters (id, organization_id, cluster_confidence)
VALUES
  ('30000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001',1.0),
  ('30000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001',1.0),
  ('30000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001',1.0),
  ('30000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001',1.0),
  ('30000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001',1.0),
  ('30000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002',1.0),
  ('30000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002',1.0)
ON CONFLICT (id) DO NOTHING;

-- 8. Unique leads (mock)
INSERT INTO unique_leads (id, organization_id, identity_cluster_id, primary_phone_e164, primary_name, first_seen_at, last_seen_at, primary_source_id, total_touches)
VALUES
  ('40000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000001','+919876543201','Rahul Sharma',NOW()-'10 days'::interval,NOW()-'10 days'::interval,'20000000-0000-0000-0000-000000000001',1),
  ('40000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000002','+919876543202','Priya Patel',NOW()-'9 days'::interval,NOW()-'9 days'::interval,'20000000-0000-0000-0000-000000000001',1),
  ('40000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000003','+919876543203','Amit Verma',NOW()-'8 days'::interval,NOW()-'8 days'::interval,'20000000-0000-0000-0000-000000000002',1),
  ('40000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000004','+919876543204','Sneha Reddy',NOW()-'7 days'::interval,NOW()-'7 days'::interval,'20000000-0000-0000-0000-000000000003',1),
  ('40000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-000000000001','30000000-0000-0000-0000-000000000005','+919876543205','Vikram Singh',NOW()-'5 days'::interval,NOW()-'5 days'::interval,'20000000-0000-0000-0000-000000000001',1),
  ('40000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000006','+919876543206','Anita Kumar',NOW()-'6 days'::interval,NOW()-'6 days'::interval,'20000000-0000-0000-0000-000000000004',1),
  ('40000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-000000000002','30000000-0000-0000-0000-000000000007','+919876543207','Suresh Nair',NOW()-'4 days'::interval,NOW()-'4 days'::interval,'20000000-0000-0000-0000-000000000005',1)
ON CONFLICT (id) DO NOTHING;

-- 9. Spend data (last 14 days for Prestige Realty sources)
INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000001',
  (CURRENT_DATE - s)::date,
  (15000 + (random() * 35000)::bigint)
FROM generate_series(1, 14) s
ON CONFLICT DO NOTHING;

INSERT INTO spend_daily (organization_id, source_id, spend_date, amount_paise)
SELECT
  '00000000-0000-0000-0000-000000000001',
  '20000000-0000-0000-0000-000000000002',
  (CURRENT_DATE - s)::date,
  (8000 + (random() * 12000)::bigint)
FROM generate_series(1, 14) s
ON CONFLICT DO NOTHING;
