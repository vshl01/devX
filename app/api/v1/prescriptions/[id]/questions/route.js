import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError, success } from '@/lib/utils/response.js';
import { AppError, ErrorCodes } from '@/lib/utils/errors.js';
import { answerPrescriptionQuestion } from '@/lib/prescriptions/prescription.questions.js';

export const runtime = 'nodejs';

/**
 * POST /api/v1/prescriptions/:id/questions
 * body: { question: string }
 */
export async function POST(request, context) {
  const requestId = createRequestId();

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'JSON body is required.', 400);
    }

    const question = /** @type {{ question?: unknown }} */ (body).question;
    if (typeof question !== 'string') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'question is required.', 400);
    }

    const data = await answerPrescriptionQuestion(id, question);
    return success(data, 200);
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
