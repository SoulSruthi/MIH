import { describe, it, expect } from 'vitest';
import { computeMetrics, aggregateFunnelCounts } from '../../src/modules/attribution/compute.js';

describe('computeMetrics', () => {
  it('computes CPL correctly', () => {
    // 10 leads, ₹10,000 spend → CPL = ₹1000 = 100000 paise
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 10, contacted: 0, qualified: 0, siteVisit: 0, deals: 0, won: 0, wonValuePaise: 0 },
      { spendPaise: 1_000_000 }, // ₹10,000
    );
    expect(result.cplPaise).toBe(100_000); // ₹1,000
  });

  it('returns null CPL when no spend', () => {
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 5, contacted: 0, qualified: 0, siteVisit: 0, deals: 0, won: 0, wonValuePaise: 0 },
      { spendPaise: 0 },
    );
    expect(result.cplPaise).toBeNull();
  });

  it('returns null CPL when no leads', () => {
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 0, contacted: 0, qualified: 0, siteVisit: 0, deals: 0, won: 0, wonValuePaise: 0 },
      { spendPaise: 500_000 },
    );
    expect(result.cplPaise).toBeNull();
  });

  it('computes ROAS correctly', () => {
    // spend ₹10,000, revenue ₹25,000 → ROAS = 2.5 → roasTimes100 = 250
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 10, contacted: 5, qualified: 3, siteVisit: 2, deals: 1, won: 1, wonValuePaise: 2_500_000 },
      { spendPaise: 1_000_000 },
    );
    expect(result.roasTimes100).toBe(250);
  });

  it('returns null ROAS when no won deals', () => {
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 10, contacted: 3, qualified: 1, siteVisit: 0, deals: 0, won: 0, wonValuePaise: 0 },
      { spendPaise: 1_000_000 },
    );
    expect(result.roasTimes100).toBeNull();
  });

  it('computes CPA correctly', () => {
    // 2 deals, ₹20,000 spend → CPA = ₹10,000 = 1,000,000 paise
    const result = computeMetrics('org1', 'src1', '2026-05-01', 'last_touch_v1',
      { uniqueLeads: 20, contacted: 10, qualified: 5, siteVisit: 3, deals: 2, won: 1, wonValuePaise: 5_000_000 },
      { spendPaise: 2_000_000 },
    );
    expect(result.cpaPaise).toBe(1_000_000); // ₹10,000
  });
});

describe('aggregateFunnelCounts', () => {
  it('counts events by type', () => {
    const events = [
      { event_type: 'contacted' },
      { event_type: 'contacted' },
      { event_type: 'qualified' },
      { event_type: 'won', deal_value_paise: 1_000_000 },
      { event_type: 'won', deal_value_paise: 2_000_000 },
    ];
    const result = aggregateFunnelCounts(events);
    expect(result.contacted).toBe(2);
    expect(result.qualified).toBe(1);
    expect(result.won).toBe(2);
    expect(result.wonValuePaise).toBe(3_000_000);
    expect(result.deals).toBe(0);
  });

  it('handles empty events array', () => {
    const result = aggregateFunnelCounts([]);
    expect(result.contacted).toBe(0);
    expect(result.won).toBe(0);
    expect(result.wonValuePaise).toBe(0);
  });
});
