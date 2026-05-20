import type { NextRequest, NextResponse } from 'next/server';
import { handlePortalWebhook } from '@/lib/portal-webhook-handler';

export async function POST(req: NextRequest): Promise<NextResponse> {
  return handlePortalWebhook(req, '99acres');
}
