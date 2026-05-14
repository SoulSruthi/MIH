export type PreferenceFields = {
  preference_bhk: string | null;
  preference_budget_band: string | null;
  preference_location: string | null;
};

const BUDGET_BANDS = ['50L-1Cr', '1-1.5Cr', '1.5-2Cr', '2-5Cr', '>5Cr'] as const;
type BudgetBand = typeof BUDGET_BANDS[number];

export function normalizePreferences(rawPayload: unknown): PreferenceFields {
  if (!rawPayload || typeof rawPayload !== 'object') {
    return { preference_bhk: null, preference_budget_band: null, preference_location: null };
  }

  const p = rawPayload as Record<string, unknown>;

  return {
    preference_bhk: normalizeBhk(p),
    preference_budget_band: normalizeBudgetBand(p),
    preference_location: normalizeLocation(p),
  };
}

function normalizeBhk(p: Record<string, unknown>): string | null {
  const raw =
    p['bhk'] ??
    p['BHK'] ??
    p['bedrooms'] ??
    p['bedroom_count'] ??
    p['preference_bhk'] ??
    p['field_bhk'] ??
    null;

  if (raw === null || raw === undefined) return null;

  const num = parseInt(String(raw), 10);
  if (!isNaN(num) && num >= 1 && num <= 5) return String(num);

  // handle "3BHK", "3 BHK", "3+BHK" patterns
  const match = String(raw).match(/([1-5])\s*\+?\s*bhk/i);
  if (match) return match[1];

  return null;
}

function normalizeBudgetBand(p: Record<string, unknown>): BudgetBand | null {
  const raw =
    p['budget'] ??
    p['budget_band'] ??
    p['preference_budget'] ??
    p['budget_range'] ??
    p['field_budget'] ??
    null;

  if (raw === null || raw === undefined) return null;

  const s = String(raw).toLowerCase().replace(/\s/g, '');

  // If already a valid band
  if (BUDGET_BANDS.includes(raw as BudgetBand)) return raw as BudgetBand;

  // Numeric INR → map to band
  const inr = parseFloat(s.replace(/[^0-9.]/g, ''));
  if (!isNaN(inr)) {
    const lakhs = s.includes('cr') ? inr * 100 : inr; // treat bare number as lakhs
    if (lakhs < 100) return '50L-1Cr';
    if (lakhs < 150) return '1-1.5Cr';
    if (lakhs < 200) return '1.5-2Cr';
    if (lakhs < 500) return '2-5Cr';
    return '>5Cr';
  }

  // String pattern matching
  if (s.includes('>5cr') || s.includes('above5cr') || s.includes('5crplus')) return '>5Cr';
  if (s.includes('2') && s.includes('5cr')) return '2-5Cr';
  if (s.includes('1.5') && s.includes('2cr')) return '1.5-2Cr';
  if (s.includes('1') && s.includes('1.5cr')) return '1-1.5Cr';
  if (s.includes('50l') || s.includes('1cr')) return '50L-1Cr';

  return null;
}

function normalizeLocation(p: Record<string, unknown>): string | null {
  const raw =
    p['location'] ??
    p['locality'] ??
    p['city'] ??
    p['area'] ??
    p['preference_location'] ??
    p['project_location'] ??
    p['field_location'] ??
    null;

  if (raw === null || raw === undefined) return null;
  const s = String(raw).trim();
  return s.length > 0 ? s : null;
}
