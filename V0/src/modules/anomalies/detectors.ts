import type { AnomalyAlert } from './types';

type SourceRollup = {
  sourceId: string;
  sourceName: string;
  thisWeekCplPaise: number | null;
  lastWeekCplPaise: number | null;
  healthScore: number | null;
  leadsLast24h: number;
  wasActiveLast7d: boolean;
};

export function detectCplSpike(source: SourceRollup, orgId: string): AnomalyAlert | null {
  const { thisWeekCplPaise, lastWeekCplPaise } = source;
  if (!thisWeekCplPaise || !lastWeekCplPaise || lastWeekCplPaise === 0) return null;
  const changeRatio = (thisWeekCplPaise - lastWeekCplPaise) / lastWeekCplPaise;
  if (changeRatio <= 0.5) return null; // < 50% increase → no alert

  return {
    orgId,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    alertType: 'cpl_spike',
    severity: 'warning',
    message: `CPL for "${source.sourceName}" increased ${Math.round(changeRatio * 100)}% week-over-week`,
    detectedAt: new Date(),
    metadata: { thisWeekCplPaise, lastWeekCplPaise, changeRatioPct: Math.round(changeRatio * 100) },
  };
}

export function detectHealthDrop(source: SourceRollup, orgId: string): AnomalyAlert | null {
  if (source.healthScore === null || source.healthScore >= 50) return null;
  return {
    orgId,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    alertType: 'health_drop',
    severity: source.healthScore < 25 ? 'critical' : 'warning',
    message: `Connector health for "${source.sourceName}" dropped to ${source.healthScore}%`,
    detectedAt: new Date(),
    metadata: { healthScore: source.healthScore },
  };
}

export function detectZeroLeads(source: SourceRollup, orgId: string): AnomalyAlert | null {
  if (!source.wasActiveLast7d || source.leadsLast24h > 0) return null;
  return {
    orgId,
    sourceId: source.sourceId,
    sourceName: source.sourceName,
    alertType: 'zero_leads',
    severity: 'warning',
    message: `No leads from "${source.sourceName}" in the last 24 hours`,
    detectedAt: new Date(),
    metadata: { leadsLast24h: 0 },
  };
}

export function detectAllAnomalies(sources: SourceRollup[], orgId: string): AnomalyAlert[] {
  const alerts: AnomalyAlert[] = [];
  for (const source of sources) {
    const cpl = detectCplSpike(source, orgId);
    if (cpl) alerts.push(cpl);
    const health = detectHealthDrop(source, orgId);
    if (health) alerts.push(health);
    const zero = detectZeroLeads(source, orgId);
    if (zero) alerts.push(zero);
  }
  return alerts;
}
