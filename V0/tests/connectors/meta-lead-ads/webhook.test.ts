import { describe, it, expect } from 'vitest';
import { createHmac } from 'crypto';
import {
  verifyMetaSignature,
  handleVerificationChallenge,
  parseLeadgenNotifications,
} from '../../../src/modules/connectors/meta-lead-ads/webhook.js';
import type { MetaWebhookBody } from '../../../src/modules/connectors/meta-lead-ads/types.js';

const SECRET = 'test-app-secret';

function sign(body: Buffer): string {
  const hex = createHmac('sha256', SECRET).update(body).digest('hex');
  return `sha256=${hex}`;
}

describe('verifyMetaSignature', () => {
  it('accepts valid signature', () => {
    const body = Buffer.from(JSON.stringify({ event: 'test' }));
    expect(verifyMetaSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('rejects tampered body', () => {
    const body = Buffer.from('original');
    const sig = sign(body);
    expect(verifyMetaSignature(Buffer.from('tampered'), sig, SECRET)).toBe(false);
  });

  it('rejects wrong secret', () => {
    const body = Buffer.from('payload');
    const sig = sign(body);
    expect(verifyMetaSignature(body, sig, 'wrong-secret')).toBe(false);
  });

  it('rejects empty signature', () => {
    const body = Buffer.from('payload');
    expect(verifyMetaSignature(body, '', SECRET)).toBe(false);
  });
});

describe('handleVerificationChallenge', () => {
  it('returns challenge when mode=subscribe and token matches', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-verify-token',
      'hub.challenge': 'CHALLENGE_ABC',
    });
    const { status, body } = handleVerificationChallenge(params, 'my-verify-token');
    expect(status).toBe(200);
    expect(body).toBe('CHALLENGE_ABC');
  });

  it('returns 403 when token does not match', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'wrong-token',
      'hub.challenge': 'CHALLENGE_ABC',
    });
    const { status } = handleVerificationChallenge(params, 'my-verify-token');
    expect(status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', () => {
    const params = new URLSearchParams({
      'hub.mode': 'unsubscribe',
      'hub.verify_token': 'my-verify-token',
      'hub.challenge': 'CHALLENGE_ABC',
    });
    const { status } = handleVerificationChallenge(params, 'my-verify-token');
    expect(status).toBe(403);
  });

  it('returns 403 when challenge is missing', () => {
    const params = new URLSearchParams({
      'hub.mode': 'subscribe',
      'hub.verify_token': 'my-verify-token',
    });
    const { status } = handleVerificationChallenge(params, 'my-verify-token');
    expect(status).toBe(403);
  });
});

describe('parseLeadgenNotifications', () => {
  const body: MetaWebhookBody = {
    object: 'page',
    entry: [{
      id: 'page-123',
      time: 1715681234,
      changes: [{
        field: 'leadgen',
        value: {
          leadgen_id: 'leadgen-456',
          page_id: 'page-123',
          form_id: 'form-789',
          ad_id: 'ad-001',
          adgroup_id: 'adset-001',
          created_time: 1715681234,
        },
      }],
    }],
  };

  it('extracts leadgen notification from body', () => {
    const result = parseLeadgenNotifications(body);
    expect(result).toHaveLength(1);
    expect(result[0].leadgenId).toBe('leadgen-456');
    expect(result[0].pageId).toBe('page-123');
    expect(result[0].formId).toBe('form-789');
    expect(result[0].adId).toBe('ad-001');
    expect(result[0].createdTime).toBeInstanceOf(Date);
  });

  it('returns empty array for non-leadgen changes', () => {
    const pageFeedBody: MetaWebhookBody = {
      object: 'page',
      entry: [{ id: 'page-1', time: 0, changes: [{ field: 'feed', value: {} as never }] }],
    };
    expect(parseLeadgenNotifications(pageFeedBody)).toHaveLength(0);
  });

  it('handles multiple entries with multiple changes', () => {
    const multi: MetaWebhookBody = {
      object: 'page',
      entry: [
        { id: 'p1', time: 0, changes: [
          { field: 'leadgen', value: { leadgen_id: 'lg-1', page_id: 'p1', form_id: 'f1', created_time: 0 } },
          { field: 'leadgen', value: { leadgen_id: 'lg-2', page_id: 'p1', form_id: 'f1', created_time: 0 } },
        ]},
      ],
    };
    expect(parseLeadgenNotifications(multi)).toHaveLength(2);
  });

  it('returns empty array for empty entry list', () => {
    expect(parseLeadgenNotifications({ object: 'page', entry: [] })).toHaveLength(0);
  });
});
