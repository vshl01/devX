import { createRequestId } from '@/lib/utils/logger.js';
import { handleRouteError } from '@/lib/utils/response.js';
import { AppError, ErrorCodes } from '@/lib/utils/errors.js';
import { prisma } from '@/lib/prisma.js';
import { loadPrescriptionFile } from '@/lib/prescriptions/storage.js';

export const runtime = 'nodejs';

/**
 * GET /api/v1/prescriptions/:id/file
 * Streams the original uploaded prescription document.
 */
export async function GET(_request, context) {
  const requestId = createRequestId();

  try {
    const { id } = await context.params;
    const prescription = await prisma.prescription.findUnique({
      where: { id },
      select: {
        originalFileName: true,
        originalMimeType: true,
      },
    });

    if (!prescription) {
      throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
    }

    const buffer = await loadPrescriptionFile(id);
    const fileName = prescription.originalFileName || 'prescription';

    return new Response(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': prescription.originalMimeType || 'application/octet-stream',
        'Content-Length': String(buffer.length),
        'Content-Disposition': `inline; filename="${encodeURIComponent(fileName)}"`,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    return handleRouteError(error, { requestId });
  }
}
