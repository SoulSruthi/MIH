'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useOrgId } from '@/lib/use-org-id';
import { formatInrLakh } from '@/lib/format-inr';

type AttributionModel = {
  id: string;
  model_code: string;
  display_name: string;
  is_operational: boolean;
  is_comparison: boolean;
};

type AttributionResult = {
  id: string;
  model_id: string;
  conversion_event_id: string;
  winning_source_id: string | null;
  weight: number;
  reason: string;
  rule_applied: string | null;
  winning_touch_at: string | null;
  conversion_events: { event_code: string; occurred_at: string } | null;
};

type ConversionEvent = {
  id: string;
  event_code: string;
  occurred_at: string;
  deal_value_paise: number | null;
  cluster_id: string | null;
};

type SourceMap = Record<string, string>;

type ComparisonRow = {
  conversion_event: ConversionEvent;
  results: Record<string, AttributionResult | null>;
};

const MODEL_ORDER = ['first_touch_v1', 'last_touch_v1', 'time_decay_v1'];
const MODEL_LABELS: Record<string, string> = {
  first_touch_v1: 'First Touch',
  last_touch_v1: 'Last Touch',
  time_decay_v1: 'Time Decay',
};
const MODEL_DESC: Record<string, string> = {
  first_touch_v1: 'Credits the first source that generated the lead',
  last_touch_v1: 'Credits the most recent touchpoint before conversion',
  time_decay_v1: 'Exponential decay — recent touchpoints get more credit',
};

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(iso));
  } catch { return iso; }
}

function eventLabel(code: string) {
  const labels: Record<string, string> = {
    deal_won: 'Deal Won',
    site_visit_completed: 'Site Visit',
    qualified: 'Qualified',
    site_visit_scheduled: 'SV Scheduled',
  };
  return labels[code] ?? code.replace(/_/g, ' ');
}

function sourceCell(result: AttributionResult | null, sources: SourceMap) {
  if (!result) return <span className="text-slate-300 text-xs">—</span>;
  const name = result.winning_source_id ? (sources[result.winning_source_id] ?? result.winning_source_id.slice(0, 8)) : '—';
  return (
    <div>
      <span className="text-sm font-medium text-slate-800">{name}</span>
      {result.rule_applied && (
        <div className="text-[10px] text-slate-400 capitalize mt-0.5">{result.rule_applied.replace(/_/g, ' ')}</div>
      )}
    </div>
  );
}

export function ComparisonModelView() {
  const orgId = useOrgId();
  const [models, setModels] = useState<AttributionModel[]>([]);
  const [rows, setRows] = useState<ComparisonRow[]>([]);
  const [sources, setSources] = useState<SourceMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [modelsRes, resultsRes, eventsRes, sourcesRes] = await Promise.all([
        fetch('/api/attribution/models', { headers: { 'x-org-id': orgId } }),
        fetch('/api/attribution/results?include_superseded=false', { headers: { 'x-org-id': orgId } }),
        fetch('/api/attribution/conversion-events?limit=20', { headers: { 'x-org-id': orgId } }),
        fetch('/api/sources', { headers: { 'x-org-id': orgId } }),
      ]);

      const modelsData = modelsRes.ok ? ((await modelsRes.json()) as { models: AttributionModel[] }).models ?? [] : [];
      const resultsData = resultsRes.ok ? ((await resultsRes.json()) as { attribution_results: AttributionResult[] }).attribution_results ?? [] : [];
      const eventsData = eventsRes.ok ? ((await eventsRes.json()) as { events: ConversionEvent[] }).events ?? [] : [];
      const sourcesData = sourcesRes.ok ? ((await sourcesRes.json()) as { sources: { id: string; name: string }[] }).sources ?? [] : [];

      setModels(modelsData);

      const sourceMap: SourceMap = {};
      for (const s of sourcesData) sourceMap[s.id] = s.name;
      setSources(sourceMap);

      // Build a model_code → model_id map
      const modelCodeToId: Record<string, string> = {};
      for (const m of modelsData) modelCodeToId[m.model_code] = m.id;

      // Group results by conversion_event_id
      const resultsByEvent: Record<string, Record<string, AttributionResult>> = {};
      for (const r of resultsData) {
        if (!resultsByEvent[r.conversion_event_id]) resultsByEvent[r.conversion_event_id] = {};
        // Use model_code lookup via model_id
        const code = modelsData.find((m) => m.id === r.model_id)?.model_code ?? r.model_id;
        resultsByEvent[r.conversion_event_id][code] = r;
      }

      // Build comparison rows for events that have at least one result
      const compRows: ComparisonRow[] = eventsData
        .filter((ev) => resultsByEvent[ev.id])
        .map((ev) => ({
          conversion_event: ev,
          results: {
            first_touch_v1: resultsByEvent[ev.id]?.first_touch_v1 ?? null,
            last_touch_v1: resultsByEvent[ev.id]?.last_touch_v1 ?? null,
            time_decay_v1: resultsByEvent[ev.id]?.time_decay_v1 ?? null,
          },
        }));

      setRows(compRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load comparison data');
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const operationalModel = models.find((m) => m.is_operational);
  const visibleModels = MODEL_ORDER.filter((code) =>
    models.some((m) => m.model_code === code)
  );

  return (
    <div className="space-y-4">
      {/* Model legend */}
      <div className="flex flex-wrap gap-3">
        {visibleModels.map((code) => {
          const m = models.find((x) => x.model_code === code);
          const isOp = m?.is_operational;
          return (
            <div key={code} className={`rounded-lg border px-4 py-2.5 flex-1 min-w-[160px] ${isOp ? 'border-blue-200 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-sm font-semibold text-slate-800">{MODEL_LABELS[code] ?? code}</span>
                {isOp && <Badge variant="info" className="text-[10px] px-1.5 py-0">Operational</Badge>}
              </div>
              <p className="text-xs text-slate-500">{MODEL_DESC[code] ?? ''}</p>
            </div>
          );
        })}
      </div>

      {operationalModel && (
        <p className="text-xs text-slate-500 bg-amber-50 border border-amber-100 rounded px-3 py-2">
          Decision-support only. <span className="font-semibold">{operationalModel.display_name}</span> is the operational model — only it drives CP commission and budget calculations.
        </p>
      )}

      <Card className="rounded-xl shadow-sm border-slate-200">
        <CardHeader className="py-3 px-5 border-b">
          <CardTitle className="text-sm font-medium text-slate-600">Attribution by Conversion Event</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="py-10 flex flex-col gap-2 px-5">
              {[...Array(4)].map((_, i) => <div key={i} className="h-10 rounded bg-slate-100 animate-pulse" />)}
            </div>
          ) : error ? (
            <p className="px-5 py-8 text-center text-red-500 text-sm">{error}</p>
          ) : rows.length === 0 ? (
            <p className="px-5 py-8 text-center text-slate-400 text-sm">No conversion events with attribution results yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Event</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Date</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-slate-500">Value</th>
                    {MODEL_ORDER.map((code) => (
                      <th key={code} className={`px-4 py-2.5 text-left font-semibold ${code === operationalModel?.model_code ? 'text-blue-600' : 'text-slate-500'}`}>
                        {MODEL_LABELS[code] ?? code}
                        {code === operationalModel?.model_code && ' ★'}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const ev = row.conversion_event;
                    const firstSource = row.results.first_touch_v1?.winning_source_id;
                    const lastSource = row.results.last_touch_v1?.winning_source_id;
                    const decaySource = row.results.time_decay_v1?.winning_source_id;
                    const allSame = firstSource && firstSource === lastSource && firstSource === decaySource;

                    return (
                      <tr key={ev.id} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1.5">
                            <Badge variant="secondary" className="text-[10px] font-normal">{eventLabel(ev.event_code)}</Badge>
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 text-xs whitespace-nowrap">{formatDate(ev.occurred_at)}</td>
                        <td className="px-4 py-3 text-slate-700 text-xs">
                          {ev.deal_value_paise ? formatInrLakh(ev.deal_value_paise) : '—'}
                        </td>
                        {MODEL_ORDER.map((code) => (
                          <td key={code} className={`px-4 py-3 ${code === operationalModel?.model_code ? 'bg-blue-50/40' : ''}`}>
                            {sourceCell(row.results[code] ?? null, sources)}
                            {!allSame && code !== 'first_touch_v1' && row.results[code]?.winning_source_id !== firstSource && (
                              <Badge variant="warning" className="text-[10px] mt-0.5 px-1 py-0">Differs</Badge>
                            )}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
