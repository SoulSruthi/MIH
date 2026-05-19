import { Resend } from 'resend';
import type { AnomalyAlert } from '@/modules/anomalies/index';

let _resend: Resend | null = null;
function getResend(): Resend {
  if (!_resend) _resend = new Resend(process.env.RESEND_API_KEY ?? 'placeholder');
  return _resend;
}

const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? 'MIH Alerts <alerts@mih.app>';

function buildAnomalyAlertHtml(alerts: AnomalyAlert[], orgName: string): string {
  const rows = alerts
    .map(
      (alert) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${alert.sourceName}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;text-transform:capitalize;">${alert.alertType.replace('_', ' ')}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">
        <span style="color:${alert.severity === 'critical' ? '#dc2626' : '#d97706'};font-weight:600;">${alert.severity.toUpperCase()}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${alert.message}</td>
    </tr>`,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <title>MIH Anomaly Alert</title>
</head>
<body style="font-family:sans-serif;color:#111827;max-width:700px;margin:0 auto;padding:24px;">
  <h2 style="margin-bottom:4px;">Anomaly Alert: ${orgName}</h2>
  <p style="color:#6b7280;margin-top:0;">${alerts.length} anomaly alert(s) detected</p>
  <table style="width:100%;border-collapse:collapse;font-size:14px;margin-top:16px;">
    <thead>
      <tr style="background:#f3f4f6;text-align:left;">
        <th style="padding:8px 12px;">Source</th>
        <th style="padding:8px 12px;">Type</th>
        <th style="padding:8px 12px;">Severity</th>
        <th style="padding:8px 12px;">Message</th>
      </tr>
    </thead>
    <tbody>
      ${rows}
    </tbody>
  </table>
  <p style="margin-top:24px;color:#6b7280;font-size:12px;">
    Detected at ${new Date().toUTCString()} · MIH Platform
  </p>
</body>
</html>
`;
}

export async function sendAnomalyAlertEmail(
  to: string,
  alerts: AnomalyAlert[],
  orgName: string,
): Promise<void> {
  const subject = `[MIH] ${alerts.length} anomaly alert(s) for ${orgName}`;

  const { error } = await getResend().emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html: buildAnomalyAlertHtml(alerts, orgName),
  });

  if (error) {
    throw new Error(`Failed to send anomaly alert email to ${to}: ${error.message}`);
  }
}
