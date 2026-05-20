import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase-admin';

export type SourceCategoryKind = 'ATL' | 'BTL' | 'Digital' | 'Niche';

export type SourceCategory = {
  id: string;
  category: SourceCategoryKind;
  name: string;
  description: string | null;
  is_custom: boolean;
  organization_id: string | null;
};

const VALID_CATEGORIES: SourceCategoryKind[] = ['ATL', 'BTL', 'Digital', 'Niche'];

type CreateSourceBody = {
  category: string;
  name: string;
  description?: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('source_categories')
    .select('id, category, name, description, is_custom, organization_id')
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .order('category')
    .order('name');

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ categories: (data ?? []) as SourceCategory[] });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const orgId = req.headers.get('x-org-id');
  if (!orgId) return NextResponse.json({ error: 'x-org-id required' }, { status: 400 });

  const body = (await req.json()) as CreateSourceBody;
  if (!body.category || !body.name) {
    return NextResponse.json({ error: 'category and name required' }, { status: 400 });
  }

  if (!VALID_CATEGORIES.includes(body.category as SourceCategoryKind)) {
    return NextResponse.json(
      { error: 'Invalid category. Must be ATL, BTL, Digital, or Niche' },
      { status: 400 },
    );
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('source_categories')
    .insert({
      organization_id: orgId,
      category: body.category as SourceCategoryKind,
      name: body.name.trim(),
      description: body.description?.trim() ?? null,
      is_custom: true,
    })
    .select('id, category, name, description, is_custom, organization_id')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, category: data as SourceCategory });
}
