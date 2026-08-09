import { failure } from '@/lib/utils/response.js';
import { ErrorCodes } from '@/lib/utils/errors.js';

export const runtime = 'nodejs';

/**
 * POST /api/v1/prescriptions/:id/questions
 * Prepared for Phase 2 — not implemented yet.
 */
export async function POST() {
  return failure(
    ErrorCodes.NOT_IMPLEMENTED,
    'Question answering will be available in a later phase.',
    501,
  );
}
