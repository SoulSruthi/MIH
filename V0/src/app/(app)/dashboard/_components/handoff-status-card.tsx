import type { HandoffStatusSummary } from '@/modules/analytics';

const STATUS_CONFIG = {
  pending: { label: 'Pending', color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
  queued: { label: 'Queued', color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
  succeeded: { label: 'Succeeded', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
  failed: { label: 'Failed', color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
  skipped: { label: 'Skipped', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' },
} as const;

type Props = { data: HandoffStatusSummary };

export function HandoffStatusCard({ data }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-3 text-sm font-semibold text-foreground">CRM Handoff Status</h3>
      <div className="flex flex-wrap gap-3">
        {(Object.keys(STATUS_CONFIG) as Array<keyof typeof STATUS_CONFIG>).map((key) => (
          <div key={key} className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${STATUS_CONFIG[key].color}`}>
            <span>{STATUS_CONFIG[key].label}</span>
            <span className="font-bold">{data[key]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
