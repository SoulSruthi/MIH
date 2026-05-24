'use client';

// Returns the default org ID for this deployment.
// In a multi-tenant setup this would come from session/auth context.
export function useOrgId(): string {
  return '00000000-0000-0000-0000-000000000001';
}
