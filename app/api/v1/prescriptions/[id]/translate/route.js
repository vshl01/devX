import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError, success } from '@/lib/utils/response.js';
import { AppError, ErrorCodes } from '@/lib/utils/errors.js';
import { translatePrescription } from '@/lib/prescriptions/prescription.service.js';

export const runtime = 'nodejs';

/**
 * POST /api/v1/prescriptions/:id/translate
 * body: { targetLanguage: "kn-IN" }
 */
export async function POST(request, context) {
  const requestId = createRequestId();

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'JSON body is required.', 400);
    }

    const targetLanguage = /** @type {{ targetLanguage?: unknown }} */ (body).targetLanguage;
    if (typeof targetLanguage !== 'string') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'targetLanguage is required.', 400);
    }

    const data = await translatePrescription(id, targetLanguage, { requestId });
    return success(data, 200);
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
