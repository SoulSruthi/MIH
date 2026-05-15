/**
 * E.164 phone normalization with Indian default (+91).
 *
 * Accepts:
 *   +919876543210   → +919876543210  (already E.164)
 *   9876543210      → +919876543210  (10-digit, prepend +91)
 *   09876543210     → +919876543210  (11-digit with leading 0)
 *   919876543210    → +919876543210  (12-digit with country code, no +)
 *   +14155552671    → +14155552671   (non-Indian E.164, pass through)
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

  // General international: 7–15 digits, no country code prefix known
  if (digits.length >= 7 && digits.length <= 15) return `+${digits}`;

  throw new PhoneNormalizationError(raw, `Cannot normalize to E.164: unrecognized format`);
}

export class PhoneNormalizationError extends Error {
  constructor(public readonly rawInput: string, message: string) {
    super(`PhoneNormalizationError: ${message} (input: '${rawInput}')`);
    this.name = 'PhoneNormalizationError';
  }
}
