'use client';
import { useEffect, useState } from 'react';
import { createBrowserClient } from '@supabase/ssr';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Fallback for demo: Prestige Realty org
const DEMO_ORG_ID = '00000000-0000-0000-0000-000000000001';

export function useOrgId(): string {
  const [orgId, setOrgId] = useState<string>(DEMO_ORG_ID);

  useEffect(() => {
    const supabase = createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    supabase.auth.getUser().then(async ({ data }) => {
      const userId = data.user?.id;
      if (!userId) return;
      const { data: membership } = await supabase
        .from('memberships')
        .select('organization_id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .single();
      if (membership?.organization_id) {
        setOrgId(membership.organization_id as string);
      }
    });
  }, []);

  return orgId;
}
