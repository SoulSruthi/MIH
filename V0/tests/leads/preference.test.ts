import { describe, it, expect } from 'vitest';
import { normalizePreferences } from '../../src/modules/leads/preference';

describe('normalizePreferences', () => {
  it('returns all nulls for empty payload', () => {
    const result = normalizePreferences({});
    expect(result).toEqual({ preference_bhk: null, preference_budget_band: null, preference_location: null });
  });

  it('returns all nulls for null input', () => {
    expect(normalizePreferences(null)).toEqual({ preference_bhk: null, preference_budget_band: null, preference_location: null });
  });

  it('normalizes BHK from numeric value', () => {
    expect(normalizePreferences({ bhk: 3 }).preference_bhk).toBe('3');
    expect(normalizePreferences({ BHK: '2' }).preference_bhk).toBe('2');
    expect(normalizePreferences({ bedrooms: 4 }).preference_bhk).toBe('4');
  });

  it('normalizes BHK from string pattern like "3BHK"', () => {
    expect(normalizePreferences({ bhk: '3BHK' }).preference_bhk).toBe('3');
    expect(normalizePreferences({ bhk: '2 BHK' }).preference_bhk).toBe('2');
  });

  it('rejects out-of-range BHK', () => {
    expect(normalizePreferences({ bhk: 0 }).preference_bhk).toBeNull();
    expect(normalizePreferences({ bhk: 6 }).preference_bhk).toBeNull();
  });

  it('maps budget band strings directly if already valid', () => {
    expect(normalizePreferences({ budget: '50L-1Cr' }).preference_budget_band).toBe('50L-1Cr');
    expect(normalizePreferences({ budget: '>5Cr' }).preference_budget_band).toBe('>5Cr');
  });

  it('normalizes location from various field names', () => {
    expect(normalizePreferences({ location: 'Whitefield' }).preference_location).toBe('Whitefield');
    expect(normalizePreferences({ locality: 'HSR Layout' }).preference_location).toBe('HSR Layout');
    expect(normalizePreferences({ city: 'Bangalore' }).preference_location).toBe('Bangalore');
  });

  it('trims whitespace from location', () => {
    expect(normalizePreferences({ location: '  Koramangala  ' }).preference_location).toBe('Koramangala');
  });

  it('returns null for empty string location', () => {
    expect(normalizePreferences({ location: '' }).preference_location).toBeNull();
    expect(normalizePreferences({ location: '   ' }).preference_location).toBeNull();
  });
});
