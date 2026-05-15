import { z } from 'zod';

const ONE_HOUR_MS = 60 * 60 * 1000;

export const RawLeadInputSchema = z.object({
  sourceExternalId: z.string().min(1, 'sourceExternalId required'),
  phoneE164: z.string().min(7, 'phoneE164 too short').max(16, 'phoneE164 too long'),
  email: z.string().email().optional(),
  name: z.string().trim().min(2, 'name must be at least 2 chars'),
  sourceCampaignId: z.string().optional(),
  sourceCampaignName: z.string().optional(),
  sourceAdId: z.string().optional(),
  sourceAdName: z.string().optional(),
  sourceCreativeId: z.string().optional(),
  sourceKeyword: z.string().optional(),
  sourceReferrerUrl: z.string().url().optional(),
  sourceReceivedAt: z
    .date()
    .refine(
      d => d.getTime() <= Date.now() + ONE_HOUR_MS,
      'sourceReceivedAt cannot be more than 1 hour in the future',
    ),
  rawPayload: z.unknown(),
});

export type ValidatedRawLeadInput = z.infer<typeof RawLeadInputSchema>;

export class ValidationError extends Error {
  constructor(public readonly issues: z.ZodIssue[]) {
    super(`Validation failed: ${issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
    this.name = 'ValidationError';
  }
}

export function validateRawLeadInput(input: unknown): ValidatedRawLeadInput {
  const result = RawLeadInputSchema.safeParse(input);
  if (!result.success) throw new ValidationError(result.error.issues);
  return result.data;
}
