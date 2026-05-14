export { resolveDedup } from './dedup.js';
export { getOrgDedupRules } from './rules.js';
export {
  lookupPhoneIdentifier,
  getClusterPrimaryLeadId,
  getUniqueLead,
  createClusterWithIdentifier,
  updateClusterPrimaryLead,
  createUniqueLead,
  updateUniqueLeadOnDuplicate,
  updateRawLeadDedup,
  writeAuditLog,
} from './graph.js';
export type {
  DedupResult,
  DedupDeps,
  DedupStatus,
  DedupOutcome,
  RawLeadRef,
  OrgDedupRules,
  UniqueLead,
  TouchSource,
} from './types.js';
