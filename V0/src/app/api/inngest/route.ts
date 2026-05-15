import { serve } from 'inngest/next';
import { inngest } from '@/inngest/client';
import { crmHandoffFunction } from '@/inngest/functions/crm-handoff';

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [crmHandoffFunction],
});
