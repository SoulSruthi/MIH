import { registerConnector } from '../_kernel/registry.js';
import type { SourceConnector, DecryptedCredentials, SourceConfig } from '../_kernel/types.js';
import { fetchPortalLeads } from './client.js';
import { normalizePortalLead } from './normalizer.js';
import type { PortalKind, PortalConfig, PortalLead } from './types.js';

function makePortalConnector(
  kind: PortalKind,
  displayName: string,
  docsUrl: string,
): SourceConnector {
  return {
    kind,
    displayName,
    vendorDocsUrl: docsUrl,
    sourceChannel: 'aggregator',
    authKind: 'api_key',
    credentialFields: [
      { name: 'api_key', label: 'API Key', kind: 'password', required: true },
      { name: 'project_id', label: 'Project ID', kind: 'text', required: true },
    ],

    async testConnection(creds: DecryptedCredentials, _config: SourceConfig) {
      try {
        await fetchPortalLeads(
          kind,
          creds as unknown as PortalConfig,
          new Date(Date.now() - 3_600_000),
        );
        return { ok: true };
      } catch (err) {
        return {
          ok: false,
          message: err instanceof Error ? err.message : 'Connection failed',
        };
      }
    },

    async pollLeads(creds: DecryptedCredentials, _config: SourceConfig, since: Date) {
      const leads = await fetchPortalLeads(kind, creds as unknown as PortalConfig, since);
      return leads.map((l) => normalizePortalLead(l));
    },

    normalizePayload(vendorPayload: unknown) {
      return normalizePortalLead(vendorPayload as PortalLead);
    },
  };
}

export const acres99Connector = makePortalConnector(
  '99acres',
  '99acres',
  'https://www.99acres.com/',
);

export const magicBricksConnector = makePortalConnector(
  'magicbricks',
  'MagicBricks',
  'https://www.magicbricks.com/',
);

export const housingComConnector = makePortalConnector(
  'housing_com',
  'Housing.com',
  'https://housing.com/',
);

registerConnector(acres99Connector);
registerConnector(magicBricksConnector);
registerConnector(housingComConnector);

export { normalizePortalLead } from './normalizer.js';
