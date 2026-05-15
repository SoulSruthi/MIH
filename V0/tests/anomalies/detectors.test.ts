import { describe, it, expect } from 'vitest';
import { detectCplSpike, detectHealthDrop, detectZeroLeads } from '../../src/modules/anomalies/detectors.js';

const BASE = {
  sourceId: 'src-1',
  sourceName: 'Google Ads',
  thisWeekCplPaise: null,
  lastWeekCplPaise: null,
  healthScore: null,
  leadsLast24h: 10,
  wasActiveLast7d: true,
};

describe('detectCplSpike', () => {
  it('returns null when CPL increase is below 50%', () => {
    expect(detectCplSpike({ ...BASE, thisWeekCplPaise: 140_000, lastWeekCplPaise: 100_000 }, 'org1')).toBeNull();
  });

  it('returns alert when CPL increases >50%', () => {
    const alert = detectCplSpike({ ...BASE, thisWeekCplPaise: 200_000, lastWeekCplPaise: 100_000 }, 'org1');
    expect(alert).not.toBeNull();
    expect(alert?.alertType).toBe('cpl_spike');
    expect(alert?.metadata.changeRatioPct).toBe(100);
  });

  it('returns null when either CPL is missing', () => {
    expect(detectCplSpike({ ...BASE, thisWeekCplPaise: null, lastWeekCplPaise: 100_000 }, 'org1')).toBeNull();
    expect(detectCplSpike({ ...BASE, thisWeekCplPaise: 200_000, lastWeekCplPaise: null }, 'org1')).toBeNull();
  });

  it('returns null when last week CPL is zero (avoid division by zero)', () => {
    expect(detectCplSpike({ ...BASE, thisWeekCplPaise: 100_000, lastWeekCplPaise: 0 }, 'org1')).toBeNull();
  });
});

describe('detectHealthDrop', () => {
  it('returns null when health >= 50', () => {
    expect(detectHealthDrop({ ...BASE, healthScore: 50 }, 'org1')).toBeNull();
    expect(detectHealthDrop({ ...BASE, healthScore: 100 }, 'org1')).toBeNull();
  });

  it('returns warning when health is 25-49', () => {
    const alert = detectHealthDrop({ ...BASE, healthScore: 40 }, 'org1');
    expect(alert?.severity).toBe('warning');
  });

  it('returns critical when health < 25', () => {
    const alert = detectHealthDrop({ ...BASE, healthScore: 10 }, 'org1');
    expect(alert?.severity).toBe('critical');
  });

  it('returns null when healthScore is null', () => {
    expect(detectHealthDrop({ ...BASE, healthScore: null }, 'org1')).toBeNull();
  });
});

describe('detectZeroLeads', () => {
  it('returns alert when source was active but has 0 leads in 24h', () => {
    const alert = detectZeroLeads({ ...BASE, leadsLast24h: 0, wasActiveLast7d: true }, 'org1');
    expect(alert?.alertType).toBe('zero_leads');
  });

  it('returns null when source was not active last 7 days', () => {
    expect(detectZeroLeads({ ...BASE, leadsLast24h: 0, wasActiveLast7d: false }, 'org1')).toBeNull();
  });

  it('returns null when source has leads in last 24h', () => {
    expect(detectZeroLeads({ ...BASE, leadsLast24h: 5, wasActiveLast7d: true }, 'org1')).toBeNull();
  });
});
