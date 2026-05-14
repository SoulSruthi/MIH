import { normalizePhoneE164, PhoneNormalizationError } from '../connectors/_kernel/normalizer.js';

export { PhoneNormalizationError };

export function normalizePhone(raw: string): string {
  return normalizePhoneE164(raw);
}

export function normalizeEmail(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const trimmed = raw.trim().toLowerCase();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function normalizeName(raw: string): string {
  return raw.trim().replace(/\s+/g, ' ');
}
