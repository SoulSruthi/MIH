import type { RecItem } from './types';

export type ResolutionResult = {
  resolution: string;
  actions_taken: string[];
};

// Determine what downstream actions should be taken for a given resolution option
export function resolveActions(item: RecItem, resolutionOption: string): ResolutionResult {
  const actions: string[] = [];

  switch (resolutionOption) {
    case 'override_attribution':
      actions.push('Attribution override recorded');
      actions.push('Commission accrual triggered for CP');
      break;
    case 'confirm_online_first':
      actions.push('Online source attribution confirmed — no change');
      break;
    case 'escalate_to_cmo':
      actions.push('Escalated to CMO review queue');
      break;
    case 'approve_merge':
      actions.push('Identity clusters merged');
      break;
    case 'reject_merge':
      actions.push('Identity clusters kept separate');
      break;
    case 'accept_manual_call':
      actions.push('Manual call attribution accepted');
      break;
    case 'assign_source_hoarding':
      actions.push('Walk-in attributed to nearby BTL/hoarding source');
      break;
    case 'assign_source_walk_in_unknown':
      actions.push('Walk-in attributed to fallback Walk-In Unknown source');
      break;
    default:
      actions.push(`Resolution applied: ${resolutionOption}`);
  }

  return { resolution: resolutionOption, actions_taken: actions };
}
