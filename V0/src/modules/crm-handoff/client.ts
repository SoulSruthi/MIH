import { createHmac } from 'crypto';
import type { CrmLeadPayload, CrmLeadResponse } from './builder';

export type CrmClientOptions = {
  baseUrl: string;
  bearerToken: string;
  hmacSecret: string;
};

export class CrmHttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string,
    public readonly retryable: boolean,
  ) {
    super(`CRM HTTP ${status}: ${body.slice(0, 200)}`);
    this.name = 'CrmHttpError';
  }
}

export async function postLeadToCrm(
  payload: CrmLeadPayload,
  opts: CrmClientOptions,
): Promise<CrmLeadResponse> {
  const timestamp = new Date().toISOString();
  const bodyStr = JSON.stringify(payload);
  const signature = computeHmac(opts.hmacSecret, timestamp, bodyStr);

  const res = await fetch(`${opts.baseUrl}/api/sister/v1/leads`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${opts.bearerToken}`,
      'X-Builtrix-Signature': `sha256=${signature}`,
      'X-Builtrix-Timestamp': timestamp,
      'X-Builtrix-Idempotency-Key': payload.external_id,
    },
    body: bodyStr,
    signal: AbortSignal.timeout(30_000),
  });

  const responseText = await res.text();

  if (res.status === 200 || res.status === 201) {
    try {
      return JSON.parse(responseText) as CrmLeadResponse;
    } catch {
      throw new CrmHttpError(res.status, responseText, false);
    }
  }

  // 4xx = permanent failure, no retry
  const is4xx = res.status >= 400 && res.status < 500;
  // 5xx or timeout = retryable
  const retryable = !is4xx;

  throw new CrmHttpError(res.status, responseText, retryable);
}

function computeHmac(secret: string, timestamp: string, body: string): string {
  return createHmac('sha256', secret)
    .update(`${timestamp}.${body}`)
    .digest('hex');
}
