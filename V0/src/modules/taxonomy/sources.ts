/**
 * Taxonomy source operations (Spec 01 V0)
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  MihSource,
  MihSourceTree,
  LifecycleState,
  CreateCustomSourceInput,
} from './types';
import { isValidLifecycleTransition } from './types';

export { isValidLifecycleTransition };
export type { MihSource, MihSourceTree, LifecycleState, CreateCustomSourceInput };

export class TaxonomyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TaxonomyError';
  }
}

/**
 * Fetch all sources for an org and return them as a hierarchical tree.
 */
export async function getSourceTree(
  supabase: SupabaseClient,
  orgId: string,
): Promise<MihSourceTree[]> {
  const { data, error } = await supabase
    .schema('mih')
    .from('sources')
    .select('*')
    .eq('org_id', orgId)
    .order('taxonomy_path');

  if (error) throw new TaxonomyError(`Failed to fetch sources: ${error.message}`);

  const sources = (data ?? []) as MihSource[];
  return buildTree(sources);
}

/**
 * Build hierarchical tree from flat list.
 */
function buildTree(sources: MihSource[]): MihSourceTree[] {
  const map = new Map<string, MihSourceTree>();
  const roots: MihSourceTree[] = [];

  for (const s of sources) {
    map.set(s.id, { ...s, children: [] });
  }

  for (const s of sources) {
    const node = map.get(s.id)!;
    if (s.parent_id && map.has(s.parent_id)) {
      map.get(s.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

/**
 * Get a single source by ID.
 */
export async function getSourceById(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
): Promise<MihSource | null> {
  const { data, error } = await supabase
    .schema('mih')
    .from('sources')
    .select('*')
    .eq('org_id', orgId)
    .eq('id', sourceId)
    .single();

  if (error) return null;
  return data as MihSource;
}

/**
 * Create a custom source under the custom.* namespace.
 * The taxonomy_path is derived from the parent's taxonomy_path + code.
 */
export async function createCustomSource(
  supabase: SupabaseClient,
  input: CreateCustomSourceInput,
): Promise<MihSource> {
  // Validate code: snake_case only
  if (!/^[a-z][a-z0-9_]*$/.test(input.code)) {
    throw new TaxonomyError('code must be snake_case (lowercase letters, digits, underscores)');
  }

  // Get parent to build taxonomy_path
  const parent = await getSourceById(supabase, input.org_id, input.parent_id);
  if (!parent) throw new TaxonomyError('Parent source not found');

  // Custom sources always go under custom.* namespace
  const parentPath = parent.taxonomy_path;
  // Ensure the path goes under custom namespace if not already
  const taxonomyPath = `${parentPath}.${input.code}`;

  const { data, error } = await supabase
    .schema('mih')
    .from('sources')
    .insert({
      org_id: input.org_id,
      parent_id: input.parent_id,
      level: input.level,
      code: input.code,
      display_name: input.display_name,
      taxonomy_path: taxonomyPath,
      attributes: input.attributes ?? {},
      is_platform_managed: false,
      lifecycle_state: 'active',
      created_by: input.created_by ?? null,
    })
    .select('*')
    .single();

  if (error) throw new TaxonomyError(`Failed to create source: ${error.message}`);
  return data as MihSource;
}

/**
 * Update lifecycle state with state machine validation.
 */
export async function updateSourceLifecycle(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  newState: LifecycleState,
): Promise<MihSource> {
  const source = await getSourceById(supabase, orgId, sourceId);
  if (!source) throw new TaxonomyError('Source not found');

  if (!isValidLifecycleTransition(source.lifecycle_state, newState)) {
    throw new TaxonomyError(
      `Invalid lifecycle transition: ${source.lifecycle_state} → ${newState}`,
    );
  }

  const { data, error } = await supabase
    .schema('mih')
    .from('sources')
    .update({ lifecycle_state: newState })
    .eq('org_id', orgId)
    .eq('id', sourceId)
    .select('*')
    .single();

  if (error) throw new TaxonomyError(`Failed to update source: ${error.message}`);
  return data as MihSource;
}

/**
 * Update display_name and/or attributes (code is immutable — enforced by DB trigger).
 */
export async function updateSourceAttributes(
  supabase: SupabaseClient,
  orgId: string,
  sourceId: string,
  updates: { display_name?: string; attributes?: Record<string, unknown>; lifecycle_state?: LifecycleState },
): Promise<MihSource> {
  const source = await getSourceById(supabase, orgId, sourceId);
  if (!source) throw new TaxonomyError('Source not found');

  // Validate lifecycle transition if provided
  if (updates.lifecycle_state && updates.lifecycle_state !== source.lifecycle_state) {
    if (!isValidLifecycleTransition(source.lifecycle_state, updates.lifecycle_state)) {
      throw new TaxonomyError(
        `Invalid lifecycle transition: ${source.lifecycle_state} → ${updates.lifecycle_state}`,
      );
    }
  }

  const patch: Record<string, unknown> = {};
  if (updates.display_name !== undefined) patch.display_name = updates.display_name;
  if (updates.attributes !== undefined) patch.attributes = updates.attributes;
  if (updates.lifecycle_state !== undefined) patch.lifecycle_state = updates.lifecycle_state;

  const { data, error } = await supabase
    .schema('mih')
    .from('sources')
    .update(patch)
    .eq('org_id', orgId)
    .eq('id', sourceId)
    .select('*')
    .single();

  if (error) throw new TaxonomyError(`Failed to update source: ${error.message}`);
  return data as MihSource;
}
