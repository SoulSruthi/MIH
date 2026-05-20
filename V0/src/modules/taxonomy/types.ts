/**
 * Types for Taxonomy module (Spec 01 V0)
 */

export type SourceLevel = 'channel' | 'medium' | 'source' | 'sub_source';

export type LifecycleState = 'active' | 'launch_only' | 'paused' | 'killed';

export type MihSource = {
  id: string;
  org_id: string;
  parent_id: string | null;
  level: SourceLevel;
  code: string;
  display_name: string;
  taxonomy_path: string;
  attributes: Record<string, unknown>;
  is_platform_managed: boolean;
  lifecycle_state: LifecycleState;
  launch_only_for_project_ids: string[];
  created_at: string;
  created_by: string | null;
};

export type MihSourceTree = MihSource & {
  children: MihSourceTree[];
};

/** Valid lifecycle state transitions */
const VALID_TRANSITIONS: Record<LifecycleState, LifecycleState[]> = {
  active: ['paused', 'launch_only', 'killed'],
  launch_only: ['active', 'paused', 'killed'],
  paused: ['active', 'killed'],
  killed: [],  // terminal state — cannot reactivate
};

export function isValidLifecycleTransition(from: LifecycleState, to: LifecycleState): boolean {
  return VALID_TRANSITIONS[from].includes(to);
}

export type CreateCustomSourceInput = {
  org_id: string;
  parent_id: string;
  code: string;
  display_name: string;
  level: SourceLevel;
  attributes?: Record<string, unknown>;
  created_by?: string;
};
