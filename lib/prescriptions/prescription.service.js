import { readFile } from 'node:fs/promises';
import { prisma } from '../prisma.js';
import { digitiseDocument } from '../sarvam/document.js';
import { extractPrescriptionFields } from '../sarvam/extract.js';
import { resolveSourceLanguageCode } from '../sarvam/languages.js';
import { translateCanonicalPrescription } from '../sarvam/translate.js';
import { isPresentationTranslation } from './presentation.js';
import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { mapExtractResultToCanonical } from './prescription.mapper.js';
import {
  validateTargetLanguage,
  validateUploadFile,
} from './prescription.validator.js';
import { resolveStoredFilePath, storePrescriptionFile } from './storage.js';
import {
  ACTIVE_PROCESSING_STATUSES,
  PrescriptionStatus,
  canTransitionStatus,
} from './status.js';

/**
 * Upload a prescription and kick off async Sarvam processing.
 *
 * @param {{ file: File, targetLanguage?: string | null, requestId?: string }} input
 */
export async function uploadPrescription(input) {
  const validated = await validateUploadFile(input.file);
  const targetLanguage = validateTargetLanguage(input.targetLanguage);

  const stored = await storePrescriptionFile({
    buffer: validated.buffer,
    fileName: validated.fileName,
  });

  const prescription = await prisma.prescription.create({
    data: {
      originalFileName: validated.fileName,
      originalMimeType: validated.mimeType,
      originalFileReference: stored.relativePath,
      status: PrescriptionStatus.CREATED,
      targetLanguage,
    },
  });

  logger.info('prescription_created', {
    requestId: input.requestId,
    prescriptionId: prescription.id,
    operation: 'upload',
    status: prescription.status,
  });

  // Fire-and-forget background processing; HTTP returns immediately.
  void processPrescriptionPipeline(prescription.id, {
    requestId: input.requestId,
  }).catch((error) => {
    logger.error('prescription_pipeline_unhandled', {
      requestId: input.requestId,
      prescriptionId: prescription.id,
      message: error instanceof Error ? error.message : 'unknown',
    });
  });

  return {
    prescriptionId: prescription.id,
    status: PrescriptionStatus.CREATED,
  };
}

/**
 * Full digitise → extract → optional translate pipeline.
 *
 * @param {string} prescriptionId
 * @param {{ requestId?: string }} [context]
 */
export async function processPrescriptionPipeline(prescriptionId, context = {}) {
  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
  });

  if (!prescription) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  if (
    prescription.status === PrescriptionStatus.COMPLETED
    || prescription.status === PrescriptionStatus.PARTIALLY_COMPLETED
  ) {
    return prescription;
  }

  // Idempotency: if a digitise job is already active, do not start another.
  if (
    prescription.sarvamJobId
    && ACTIVE_PROCESSING_STATUSES.includes(prescription.status)
    && prescription.status !== PrescriptionStatus.CREATED
    && prescription.status !== PrescriptionStatus.UPLOADING
  ) {
    logger.info('prescription_pipeline_skip_duplicate', {
      requestId: context.requestId,
      prescriptionId,
      sarvamJobId: prescription.sarvamJobId,
      status: prescription.status,
    });
  }

  try {
    await transitionStatus(prescriptionId, PrescriptionStatus.UPLOADING, context);
    const absolutePath = resolveStoredFilePath(prescription.originalFileReference);
    const buffer = await readFile(absolutePath);

    await transitionStatus(prescriptionId, PrescriptionStatus.DIGITISING, context);

    let digitise;
    if (prescription.sarvamJobId && prescription.rawDigitisedText) {
      digitise = {
        jobId: prescription.sarvamJobId,
        rawText: prescription.rawDigitisedText,
        rawResult: prescription.rawDigitisedJson,
        status: 'completed',
      };
    } else {
      digitise = await digitiseDocument({
        buffer,
        fileName: prescription.originalFileName,
        mimeType: prescription.originalMimeType,
        language: prescription.originalLanguage || 'en-IN',
        contentType: 'handwritten',
      });

      await prisma.prescription.update({
        where: { id: prescriptionId },
        data: {
          sarvamJobId: digitise.jobId,
          rawDigitisedText: digitise.rawText,
          rawDigitisedJson: digitise.rawResult,
        },
      });
    }

    await transitionStatus(prescriptionId, PrescriptionStatus.EXTRACTING, context);

    const extracted = await extractPrescriptionFields({
      buffer,
      fileName: prescription.originalFileName,
      mimeType: prescription.originalMimeType,
      language: prescription.originalLanguage || 'en-IN',
    });

    const mapped = mapExtractResultToCanonical(extracted.result, {
      annotations: extracted.annotations,
    });

    const partial =
      extracted.status === 'partially_completed'
      || !digitise.rawText;

    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        sarvamExtractJobId: extracted.jobId,
        structuredData: mapped.prescription,
        originalLanguage:
          (() => {
            const resolved = resolveSourceLanguageCode(mapped.originalLanguage);
            if (resolved !== 'auto') return resolved;
            const existing = resolveSourceLanguageCode(prescription.originalLanguage);
            return existing !== 'auto' ? existing : null;
          })(),
        errorCode: null,
        errorMessage: null,
      },
    });

    if (prescription.targetLanguage) {
      await transitionStatus(prescriptionId, PrescriptionStatus.TRANSLATING, context);
      await translatePrescription(prescriptionId, prescription.targetLanguage, {
        requestId: context.requestId,
      });
    }

    const finalStatus = partial
      ? PrescriptionStatus.PARTIALLY_COMPLETED
      : PrescriptionStatus.COMPLETED;

    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: finalStatus,
        errorCode: null,
        errorMessage: null,
      },
    });

    logger.info('prescription_pipeline_completed', {
      requestId: context.requestId,
      prescriptionId,
      operation: 'process',
      status: finalStatus,
      sarvamJobId: digitise.jobId,
    });

    return prisma.prescription.findUnique({ where: { id: prescriptionId } });
  } catch (error) {
    const message = error instanceof AppError
      ? error.message
      : 'Unable to process the prescription document.';
    const code = error instanceof AppError
      ? error.code
      : ErrorCodes.SARVAM_DOCUMENT_PROCESSING_FAILED;

    await prisma.prescription.update({
      where: { id: prescriptionId },
      data: {
        status: PrescriptionStatus.FAILED,
        errorCode: code,
        errorMessage: message,
      },
    });

    logger.error('prescription_pipeline_failed', {
      requestId: context.requestId,
      prescriptionId,
      operation: 'process',
      code,
      message,
    });

    throw error;
  }
}

/**
 * @param {string} id
 */
export async function getPrescriptionById(id) {
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    include: {
      translations: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!prescription) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  return {
    id: prescription.id,
    status: prescription.status,
    originalFileName: prescription.originalFileName,
    originalMimeType: prescription.originalMimeType,
    fileUrl: `/api/v1/prescriptions/${prescription.id}/file`,
    originalLanguage: prescription.originalLanguage,
    rawText: prescription.rawDigitisedText,
    prescription: prescription.structuredData,
    targetLanguage: prescription.targetLanguage,
    translations: prescription.translations.map((t) => ({
      id: t.id,
      targetLanguage: t.targetLanguage,
      translatedData: t.translatedData,
      createdAt: t.createdAt,
    })),
    error: prescription.errorCode
      ? { code: prescription.errorCode, message: prescription.errorMessage }
      : null,
    createdAt: prescription.createdAt,
    updatedAt: prescription.updatedAt,
  };
}

/**
 * @param {string} id
 */
export async function getPrescriptionRaw(id) {
  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: {
      id: true,
      rawDigitisedText: true,
      status: true,
    },
  });

  if (!prescription) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  return {
    prescriptionId: prescription.id,
    rawText: prescription.rawDigitisedText,
    source: 'sarvam-digitise',
    status: prescription.status,
  };
}

/**
 * Translate canonical structured data. Caches by prescriptionId + targetLanguage.
 *
 * @param {string} prescriptionId
 * @param {string} targetLanguage
 * @param {{ requestId?: string, skipStatusGuard?: boolean }} [context]
 */
export async function translatePrescription(prescriptionId, targetLanguage, context = {}) {
  const language = validateTargetLanguage(targetLanguage);
  if (!language) {
    throw new AppError(ErrorCodes.UNSUPPORTED_LANGUAGE, 'targetLanguage is required.', 400);
  }

  const prescription = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
  });

  if (!prescription) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  if (!prescription.structuredData) {
    throw new AppError(
      ErrorCodes.PRESCRIPTION_NOT_READY,
      'Prescription has not been extracted yet.',
      409,
    );
  }

  const existing = await prisma.prescriptionTranslation.findUnique({
    where: {
      prescriptionId_targetLanguage: {
        prescriptionId,
        targetLanguage: language,
      },
    },
  });

  // Only reuse cache when it is a full presentation translation (v2+).
  // Legacy value-only JSON clones kept English UI labels — regenerate those.
  if (existing && isPresentationTranslation(existing.translatedData)) {
    logger.info('translation_cache_hit', {
      requestId: context.requestId,
      prescriptionId,
      targetLanguage: language,
    });
    return {
      prescriptionId,
      targetLanguage: language,
      translatedData: existing.translatedData,
      cached: true,
    };
  }

  const translatedData = await translateCanonicalPrescription(
    prescription.structuredData,
    language,
    { sourceLanguageCode: resolveSourceLanguageCode(prescription.originalLanguage) },
  );

  const created = existing
    ? await prisma.prescriptionTranslation.update({
      where: { id: existing.id },
      data: { translatedData },
    })
    : await prisma.prescriptionTranslation.create({
      data: {
        prescriptionId,
        targetLanguage: language,
        translatedData,
      },
    });

  logger.info(existing ? 'translation_upgraded' : 'translation_created', {
    requestId: context.requestId,
    prescriptionId,
    targetLanguage: language,
  });

  return {
    prescriptionId,
    targetLanguage: language,
    translatedData: created.translatedData,
    cached: false,
  };
}

/**
 * @param {string} prescriptionId
 * @param {string} nextStatus
 * @param {{ requestId?: string }} [context]
 */
async function transitionStatus(prescriptionId, nextStatus, context = {}) {
  const current = await prisma.prescription.findUnique({
    where: { id: prescriptionId },
    select: { status: true },
  });

  if (!current) {
    throw new AppError(ErrorCodes.PRESCRIPTION_NOT_FOUND, 'Prescription not found.', 404);
  }

  if (!canTransitionStatus(current.status, nextStatus)) {
    throw new AppError(
      ErrorCodes.INVALID_STATUS_TRANSITION,
      `Cannot transition from ${current.status} to ${nextStatus}.`,
      409,
    );
  }

  await prisma.prescription.update({
    where: { id: prescriptionId },
    data: { status: nextStatus },
  });

  logger.info('prescription_status_changed', {
    requestId: context.requestId,
    prescriptionId,
    operation: 'status',
    from: current.status,
    status: nextStatus,
  });
}
