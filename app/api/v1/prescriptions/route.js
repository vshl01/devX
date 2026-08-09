import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError, success } from '@/lib/utils/response.js';
import { uploadPrescription } from '@/lib/prescriptions/prescription.service.js';

export const runtime = 'nodejs';

/**
 * POST /api/v1/prescriptions
 * multipart/form-data: file, optional targetLanguage
 */
export async function POST(request) {
  const requestId = createRequestId();

  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const targetLanguage = formData.get('targetLanguage');

    const result = await uploadPrescription({
      file: /** @type {File} */ (file),
      targetLanguage: typeof targetLanguage === 'string' ? targetLanguage : null,
      requestId,
    });

    return success(
      {
        prescriptionId: result.prescriptionId,
        status: 'PROCESSING',
      },
      202,
    );
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
