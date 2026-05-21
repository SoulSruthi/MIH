import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { spendSyncFunction } from '@/inngest/functions/spend-sync';
import { attributionRollupFunction } from '@/inngest/functions/attribution-rollup';
import { anomalyDigestFunction } from '@/inngest/functions/anomaly-digest';
import { attributionRecomputeFunction } from '@/inngest/functions/attribution-recompute';
import { projectSourceAutoDisableFunction } from '@/inngest/functions/project-source-autodisable';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [spendSyncFunction, attributionRollupFunction, anomalyDigestFunction, attributionRecomputeFunction, projectSourceAutoDisableFunction],
});
