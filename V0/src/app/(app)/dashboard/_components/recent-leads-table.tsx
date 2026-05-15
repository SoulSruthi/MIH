import type { RecentLead } from '@/modules/analytics';

function maskPhone(phone: string): string {
  if (phone.length < 6) return phone;
  return phone.slice(0, -4).replace(/\d/g, '*') + phone.slice(-4);
}

const DEDUP_BADGE: Record<string, string> = {
  unique: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  duplicate: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300',
  pending: 'bg-gray-100 text-gray-700',
};

const HANDOFF_BADGE: Record<string, string> = {
  succeeded: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  queued: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',
  skipped: 'bg-gray-100 text-gray-700',
  'n/a': 'bg-gray-50 text-gray-500',
};

type Props = {
  leads: RecentLead[];
  maskPhones?: boolean;
};

export function RecentLeadsTable({ leads, maskPhones = true }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Recent 50 Leads</h3>
      {leads.length === 0 ? (
        <p className="text-sm text-muted-foreground">No leads yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-4">Name</th>
                <th className="pb-2 pr-4">Phone</th>
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4">Dedup</th>
                <th className="pb-2 pr-4">CRM</th>
                <th className="pb-2 text-right">When</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead) => (
                <tr key={lead.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="py-2 pr-4 font-medium">{lead.primary_name}</td>
                  <td className="py-2 pr-4 font-mono text-xs text-muted-foreground">
                    {maskPhones ? maskPhone(lead.primary_phone_e164) : lead.primary_phone_e164}
                  </td>
                  <td className="py-2 pr-4 text-muted-foreground">{lead.source_name ?? '—'}</td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${DEDUP_BADGE[lead.dedup_status] ?? DEDUP_BADGE.pending}`}>
                      {lead.dedup_status}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${HANDOFF_BADGE[lead.crm_handoff_status] ?? HANDOFF_BADGE['n/a']}`}>
                      {lead.crm_handoff_status}
                    </span>
                  </td>
                  <td className="py-2 text-right text-xs text-muted-foreground">
                    {new Date(lead.ingested_at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
