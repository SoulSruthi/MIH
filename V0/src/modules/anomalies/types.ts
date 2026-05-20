export type AlertType = 'cpl_spike' | 'health_drop' | 'zero_leads';

export type AlertSeverity = 'warning' | 'critical';

export type AnomalyAlert = {
  orgId: string;
  sourceId: string;
  sourceName: string;
  alertType: AlertType;
  severity: AlertSeverity;
  message: string;
  detectedAt: Date;
  metadata: Record<string, unknown>;
};
