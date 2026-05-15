import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type OrgRole =
  | 'mih_org_admin'
  | 'marketing_manager'
  | 'marketing_analyst'
  | 'marketing_ops'
  | 'org_viewer';

export type OrgMember = {
  membership_id: string;
  user_id: string;
  email: string;
  role: OrgRole;
  joined_at: string;
  invited_by: string | null;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('org_memberships')
    .select('id, user_id, role, joined_at, invited_by, users:user_id(email)')
    .eq('organization_id', orgId)
    .order('joined_at');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const members: OrgMember[] = (data ?? []).map((row: Record<string, unknown>) => ({
    membership_id: row.id as string,
    user_id: row.user_id as string,
    email: ((row.users as Record<string, string> | null)?.email) ?? 'unknown@example.com',
    role: row.role as OrgRole,
    joined_at: row.joined_at as string,
    invited_by: row.invited_by as string | null,
  }));

  return NextResponse.json({ members });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = await req.json() as { email: string; role: OrgRole };
  if (!body.email || !body.role) {
    return NextResponse.json({ error: 'email and role required' }, { status: 400 });
  }

  const VALID_ROLES: OrgRole[] = ['mih_org_admin', 'marketing_manager', 'marketing_analyst', 'marketing_ops', 'org_viewer'];
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Invite user via Supabase Auth (sends email)
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const { data: inviteData, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(
    body.email,
    { redirectTo: `${siteUrl}/auth/accept-invite` },
  );

  if (inviteError) return NextResponse.json({ error: inviteError.message }, { status: 500 });

  // Create membership row
  const { error: memberError } = await supabase
    .from('org_memberships')
    .insert({
      organization_id: orgId,
      user_id: inviteData.user.id,
      role: body.role,
    });

  if (memberError) return NextResponse.json({ error: memberError.message }, { status: 500 });

  return NextResponse.json({ ok: true, user_id: inviteData.user.id });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = await req.json() as { membership_id: string; role: OrgRole };
  if (!body.membership_id || !body.role) {
    return NextResponse.json({ error: 'membership_id and role required' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('org_memberships')
    .update({ role: body.role })
    .eq('id', body.membership_id)
    .eq('organization_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const { searchParams } = req.nextUrl;
  const membershipId = searchParams.get('membership_id');
  if (!membershipId) return NextResponse.json({ error: 'membership_id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { error } = await supabase
    .from('org_memberships')
    .delete()
    .eq('id', membershipId)
    .eq('organization_id', orgId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
