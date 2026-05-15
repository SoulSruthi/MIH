import { describe, it, expect } from 'vitest';
import { normalizePhoneE164, PhoneNormalizationError } from '../../src/modules/connectors/_kernel/normalizer.js';

describe('normalizePhoneE164 — Indian default (+91)', () => {
  it('passes through already-valid E.164', () => {
    expect(normalizePhoneE164('+919876543210')).toBe('+919876543210');
  });

  it('normalizes 10-digit number', () => {
    expect(normalizePhoneE164('9876543210')).toBe('+919876543210');
  });

  it('normalizes 11-digit number with leading 0', () => {
    expect(normalizePhoneE164('09876543210')).toBe('+919876543210');
  });

  it('normalizes 12-digit number with country code (no +)', () => {
    expect(normalizePhoneE164('919876543210')).toBe('+919876543210');
  });

  it('passes through non-Indian E.164 unchanged', () => {
    expect(normalizePhoneE164('+14155552671')).toBe('+14155552671');
  });

  it('strips spaces and dashes before normalizing', () => {
    expect(normalizePhoneE164('98765 43210')).toBe('+919876543210');
    expect(normalizePhoneE164('98765-43210')).toBe('+919876543210');
  });

  it('strips parentheses and dots', () => {
    expect(normalizePhoneE164('(987)654.3210')).toBe('+919876543210');
  });

  it('throws PhoneNormalizationError for clearly invalid input', () => {
    expect(() => normalizePhoneE164('123')).toThrow(PhoneNormalizationError);
    expect(() => normalizePhoneE164('')).toThrow(PhoneNormalizationError);
  });

  it('PhoneNormalizationError carries rawInput', () => {
    try {
      normalizePhoneE164('abc');
    } catch (e) {
      expect(e).toBeInstanceOf(PhoneNormalizationError);
      expect((e as PhoneNormalizationError).rawInput).toBe('abc');
    }
  });

  it('all three variants of a number resolve to same E.164', () => {
    const a = normalizePhoneE164('+919876543210');
    const b = normalizePhoneE164('9876543210');
    const c = normalizePhoneE164('09876543210');
    expect(a).toBe(b);
    expect(b).toBe(c);
  });
});
