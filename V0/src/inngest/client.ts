import { Inngest } from 'inngest';

export const inngest = new Inngest({
  id: 'mih',
  name: 'MIH Lead Intelligence',
});

// Typed event map for compile-time safety
export type MihEvents = {
  'mih/lead.dedup_decided': {
    data: {
      unique_lead_id: string;
      dedup_status: 'unique' | 'duplicate';
      org_id: string;
      org_slug: string;
    };
  };
  'mih/crm.event_received': {
    data: {
      event_id: string;
      event_kind: string;
      unique_lead_id: string | null;
      org_id: string;
    };
  };
  'mih/crm.handoff_retry': {
    data: {
      unique_lead_id: string;
      org_id: string;
      attempt_number: number;
    };
  };
};
