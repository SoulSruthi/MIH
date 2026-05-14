import type { SourceRow } from '@/modules/analytics';

type Props = { rows: SourceRow[] };

export function LeadsBySource({ rows }: Props) {
  const maxRaw = Math.max(...rows.map((r) => r.raw), 1);

  return (
    <div className="rounded-lg border bg-card p-4">
      <h3 className="mb-4 text-sm font-semibold text-foreground">Leads by Source</h3>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">No data for this period.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="pb-2 pr-4">Source</th>
                <th className="pb-2 pr-4 text-right">Raw</th>
                <th className="pb-2 pr-4 text-right">Unique</th>
                <th className="pb-2 pr-4 text-right">Dup %</th>
                <th className="pb-2 text-right">CRM ✓</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.source_id} className="border-b last:border-0">
                  <td className="py-2 pr-4">
                    <div>
                      <span className="font-medium">{row.source_name}</span>
                      {/* Bar chart inline */}
                      <div className="mt-1 h-1.5 w-full rounded-full bg-muted">
                        <div
                          className="h-1.5 rounded-full bg-blue-500"
                          style={{ width: `${Math.round((row.raw / maxRaw) * 100)}%` }}
                        />
                      </div>
                    </div>
                  </td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.raw}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{row.unique}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">
                    <span className={row.dup_pct > 30 ? 'text-orange-600' : 'text-muted-foreground'}>
                      {row.dup_pct}%
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums text-green-600">{row.crm_success}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
