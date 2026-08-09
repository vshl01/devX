import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError, success } from '@/lib/utils/response.js';
import { getPrescriptionRaw } from '@/lib/prescriptions/prescription.service.js';

export const runtime = 'nodejs';

/**
 * GET /api/v1/prescriptions/:id/raw
 */
export async function GET(_request, context) {
  const requestId = createRequestId();

  try {
    const { id } = await context.params;
    const data = await getPrescriptionRaw(id);
    return success(data, 200);
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
