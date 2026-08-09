import { randomUUID } from 'node:crypto';

import { prisma } from '../prisma.js';
import { AppError, ErrorCodes } from '../utils/errors.js';

/**
 * Uploaded documents live in the database, not on disk.
 *
 * Serverless hosts give each invocation a read-only filesystem and no shared
 * storage between invocations, so a file written during upload is gone by the
 * time the pipeline or a download request looks for it. The bytes go in the
 * `Prescription.originalFileData` column instead, and the reference below is
 * only a human-readable label for logs and downloads.
 *
 * @param {string} fileName
 * @returns {string}
 */
export function buildFileReference(fileName) {
  const safeName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `${Date.now()}_${randomUUID()}_${safeName}`;
}

/**
 * Read back the stored document for a prescription.
 *
 * @param {string} prescriptionId
 * @returns {Promise<Buffer>}
 */
export async function loadPrescriptionFile(prescriptionId) {
  const row = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: { originalFileData: true },
  });

  if (!row?.originalFileData) {
    throw new AppError(
      ErrorCodes.PRESCRIPTION_NOT_FOUND,
      'The stored document for this prescription is missing.',
      404,
    );
  }

  return Buffer.from(row.originalFileData);
}
