import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError, success } from '@/lib/utils/response.js';
import { AppError, ErrorCodes } from '@/lib/utils/errors.js';
import { answerPrescriptionQuestion } from '@/lib/prescriptions/prescription.questions.js';

export const runtime = 'nodejs';

/**
 * POST /api/v1/prescriptions/:id/questions
 * body: {
 *   question: string,
 *   language?: string,          // e.g. "kn-IN" — response language override
 *   history?: Array<{ role: 'user'|'assistant', text: string }>,
 *   includeAudio?: boolean      // optional Bulbul TTS
 * }
 */
export async function POST(request, context) {
  const requestId = createRequestId();

  try {
    const { id } = await context.params;
    const body = await request.json().catch(() => null);

    if (!body || typeof body !== 'object') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'JSON body is required.', 400);
    }

    const payload = /** @type {{
      question?: unknown,
      language?: unknown,
      history?: unknown,
      includeAudio?: unknown,
    }} */ (body);

    if (typeof payload.question !== 'string') {
      throw new AppError(ErrorCodes.VALIDATION_ERROR, 'question is required.', 400);
    }

    const data = await answerPrescriptionQuestion(id, payload.question, {
      language: typeof payload.language === 'string' ? payload.language : null,
      history: Array.isArray(payload.history) ? payload.history : [],
      includeAudio: payload.includeAudio === true,
    });

    return success(data, 200);
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
