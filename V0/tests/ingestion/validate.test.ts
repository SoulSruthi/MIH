import { describe, it, expect } from 'vitest';
import { validateRawLeadInput, ValidationError } from '../../src/modules/ingestion/validate.js';

const VALID = {
  sourceExternalId: 'ext-123',
  phoneE164: '+919876543210',
  email: 'ravi@example.com',
  name: 'Ravi Kumar',
  sourceReceivedAt: new Date(Date.now() - 60_000),
  rawPayload: { foo: 'bar' },
};

describe('validateRawLeadInput', () => {
  it('accepts a valid input', () => {
    expect(() => validateRawLeadInput(VALID)).not.toThrow();
  });

  it('throws ValidationError for missing sourceExternalId', () => {
    expect(() => validateRawLeadInput({ ...VALID, sourceExternalId: '' })).toThrow(ValidationError);
  });

  it('throws ValidationError for name < 2 chars', () => {
    expect(() => validateRawLeadInput({ ...VALID, name: 'A' })).toThrow(ValidationError);
  });

  it('throws ValidationError for invalid email', () => {
    expect(() => validateRawLeadInput({ ...VALID, email: 'not-an-email' })).toThrow(ValidationError);
  });

  it('accepts undefined email (optional)', () => {
    expect(() => validateRawLeadInput({ ...VALID, email: undefined })).not.toThrow();
  });

  it('throws ValidationError for sourceReceivedAt more than 1 hour in the future', () => {
    const futureDate = new Date(Date.now() + 2 * 60 * 60 * 1000);
    expect(() => validateRawLeadInput({ ...VALID, sourceReceivedAt: futureDate })).toThrow(ValidationError);
  });

  it('accepts sourceReceivedAt slightly in the future (clock skew <1h)', () => {
    const nearFuture = new Date(Date.now() + 30 * 60 * 1000);
    expect(() => validateRawLeadInput({ ...VALID, sourceReceivedAt: nearFuture })).not.toThrow();
  });

  it('ValidationError carries human-readable message', () => {
    try {
      validateRawLeadInput({ ...VALID, name: 'X' });
    } catch (e) {
      expect(e).toBeInstanceOf(ValidationError);
      expect((e as ValidationError).message).toContain('name');
    }
  });
});
