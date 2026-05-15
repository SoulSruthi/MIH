import { describe, it, expect } from 'vitest';
import { normalizePhone, normalizeEmail, normalizeName, PhoneNormalizationError } from '../../src/modules/ingestion/normalize.js';

describe('normalizePhone', () => {
  it('normalizes 10-digit Indian number', () => {
    expect(normalizePhone('9876543210')).toBe('+919876543210');
  });

  it('passes through valid E.164', () => {
    expect(normalizePhone('+919876543210')).toBe('+919876543210');
  });

  it('throws PhoneNormalizationError for invalid input', () => {
    expect(() => normalizePhone('123')).toThrow(PhoneNormalizationError);
  });
});

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  Ravi@EXAMPLE.COM  ')).toBe('ravi@example.com');
  });

  it('returns undefined for empty string', () => {
    expect(normalizeEmail('')).toBeUndefined();
  });

  it('returns undefined for undefined input', () => {
    expect(normalizeEmail(undefined)).toBeUndefined();
  });
});

describe('normalizeName', () => {
  it('trims whitespace', () => {
    expect(normalizeName('  Ravi Kumar  ')).toBe('Ravi Kumar');
  });

  it('collapses internal whitespace', () => {
    expect(normalizeName('Ravi   Kumar')).toBe('Ravi Kumar');
  });
});
