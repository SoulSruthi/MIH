import { registerConnector } from '../_kernel/registry';
import type { SourceConnector, DecryptedCredentials, SourceConfig } from '../_kernel/types';
import { normalizeManualLead } from './normalizer';
import type { ManualLeadInput } from './types';

export const manualConnector: SourceConnector = {
  kind: 'manual',
  displayName: 'Manual Entry',
  vendorDocsUrl: '',
  sourceChannel: 'manual',
  // Manual entry requires no external auth; 'api_key' with no required fields
  // is the closest fit within the allowed authKind union.
  authKind: 'api_key',
  credentialFields: [],

  async testConnection(_creds: DecryptedCredentials, _config: SourceConfig) {
    return { ok: true };
  },

  async pollLeads(_creds: DecryptedCredentials, _config: SourceConfig, _since: Date) {
    // Manual entry has no poll source; leads are submitted directly via the API.
    return [];
  },

  normalizePayload(vendorPayload: unknown) {
    return normalizeManualLead(vendorPayload as ManualLeadInput);
  },
};

registerConnector(manualConnector);

export { normalizeManualLead } from './normalizer';
