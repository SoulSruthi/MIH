import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client.js';
import { spendSyncFunction } from '@/inngest/functions/spend-sync.js';
import { attributionRollupFunction } from '@/inngest/functions/attribution-rollup.js';
import { anomalyDigestFunction } from '@/inngest/functions/anomaly-digest.js';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [spendSyncFunction, attributionRollupFunction, anomalyDigestFunction],
});
