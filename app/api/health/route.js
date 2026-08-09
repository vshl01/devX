import { success } from '@/lib/utils/response.js';

export const runtime = 'nodejs';

/**
 * GET /api/health
 * Does not depend on Sarvam availability.
 */
export async function GET() {
  return success({ status: 'ok' }, 200);
}
