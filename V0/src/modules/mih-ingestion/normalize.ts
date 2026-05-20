/**
 * Normalization utilities for mih-ingestion module.
 * Mirrors the existing ingestion/normalize.ts pattern.
 */

export class PhoneNormalizationError extends Error {
  constructor(
    public readonly rawInput: string,
    message: string,
  ) {
    super(`PhoneNormalizationError: ${message} (input: '${rawInput}')`);
    this.name = 'PhoneNormalizationError';
  }
}

/**
 * Normalize a phone number to E.164 format.
 * Defaults to Indian (+91) country code for 10-digit numbers.
 */
export function normalizePhoneE164(raw: string, defaultCountryCode = '91'): string {
  const digits = raw.replace(/\D/g, '');

  // Already has + — trust the caller but validate length
  if (raw.trimStart().startsWith('+')) {
    if (digits.length < 7 || digits.length > 15) {
      throw new PhoneNormalizationError(raw, 'E.164 number out of valid length range');
    }
    return `+${digits}`;
  }

  // 10-digit → prepend default country code
  if (digits.length === 10) return `+${defaultCountryCode}${digits}`;

  // 11-digit starting with 0 → strip leading 0, prepend country code
  if (digits.length === 11 && digits.startsWith('0')) {
    return `+${defaultCountryCode}${digits.slice(1)}`;
  }

  // 12-digit → assume country code already present (e.g. 919876543210)
  if (digits.length === 12 && digits.startsWith(defaultCountryCode)) {
    return `+${digits}`;
  }

  // General international: 7–15 digits
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;

  throw new PhoneNormalizationError(raw, `Cannot normalize to E.164: unrecognized format`);
}

/**
 * Normalize email: lowercase + trim.
 */
export function normalizeEmail(raw: string | undefined | null): string | null {
  if (!raw) return null;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Normalize name: trim + collapse whitespace.
 */
export function normalizeName(raw: string | undefined | null): string | null {
  if (!raw) return null;
  return raw.trim().replace(/\s+/g, ' ') || null;
}
