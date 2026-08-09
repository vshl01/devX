export class AppError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {number} [status=500]
   * @param {unknown} [details]
   */
  constructor(code, message, status = 500, details = undefined) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

export function isAppError(error) {
  return error instanceof AppError;
}

export const ErrorCodes = Object.freeze({
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  MISSING_FILE: 'MISSING_FILE',
  UNSUPPORTED_MEDIA_TYPE: 'UNSUPPORTED_MEDIA_TYPE',
  PAYLOAD_TOO_LARGE: 'PAYLOAD_TOO_LARGE',
  EMPTY_FILE: 'EMPTY_FILE',
  CORRUPT_FILE: 'CORRUPT_FILE',
  PRESCRIPTION_NOT_FOUND: 'PRESCRIPTION_NOT_FOUND',
  PRESCRIPTION_NOT_READY: 'PRESCRIPTION_NOT_READY',
  UNSUPPORTED_LANGUAGE: 'UNSUPPORTED_LANGUAGE',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  SARVAM_DOCUMENT_PROCESSING_FAILED: 'SARVAM_DOCUMENT_PROCESSING_FAILED',
  SARVAM_EXTRACTION_FAILED: 'SARVAM_EXTRACTION_FAILED',
  SARVAM_TRANSLATION_FAILED: 'SARVAM_TRANSLATION_FAILED',
  SARVAM_REQUEST_FAILED: 'SARVAM_REQUEST_FAILED',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  NOT_IMPLEMENTED: 'NOT_IMPLEMENTED',
});
