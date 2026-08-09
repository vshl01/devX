import { AppError, ErrorCodes } from '../utils/errors.js';
import { isSupportedLanguage, normalizeLanguageCode } from '../sarvam/languages.js';

/** DocAI supports PDF, JPEG, PNG up to 50 MB. */
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export const SUPPORTED_MIME_TYPES = Object.freeze({
  'image/jpeg': ['.jpg', '.jpeg'],
  'image/png': ['.png'],
  'application/pdf': ['.pdf'],
});

/**
 * @param {File | null | undefined} file
 */
export async function validateUploadFile(file) {
  if (!file) {
    throw new AppError(ErrorCodes.MISSING_FILE, 'A prescription file is required.', 400);
  }

  if (typeof file.size === 'number' && file.size === 0) {
    throw new AppError(ErrorCodes.EMPTY_FILE, 'The uploaded file is empty.', 400);
  }

  if (typeof file.size === 'number' && file.size > MAX_UPLOAD_BYTES) {
    throw new AppError(
      ErrorCodes.PAYLOAD_TOO_LARGE,
      `File exceeds the maximum size of ${MAX_UPLOAD_BYTES} bytes.`,
      413,
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  if (buffer.length === 0) {
    throw new AppError(ErrorCodes.EMPTY_FILE, 'The uploaded file is empty.', 400);
  }

  if (buffer.length > MAX_UPLOAD_BYTES) {
    throw new AppError(
      ErrorCodes.PAYLOAD_TOO_LARGE,
      `File exceeds the maximum size of ${MAX_UPLOAD_BYTES} bytes.`,
      413,
    );
  }

  const detected = detectFileType(buffer, file.name, file.type);
  if (!detected) {
    throw new AppError(
      ErrorCodes.UNSUPPORTED_MEDIA_TYPE,
      'Unsupported file type. Upload a JPEG, PNG, or PDF prescription.',
      415,
    );
  }

  if (detected.corrupt) {
    throw new AppError(
      ErrorCodes.CORRUPT_FILE,
      'The uploaded file appears corrupt or incomplete.',
      422,
    );
  }

  return {
    buffer,
    fileName: sanitizeFileName(file.name || `prescription${detected.extension}`),
    mimeType: detected.mimeType,
    extension: detected.extension,
    size: buffer.length,
  };
}

/**
 * @param {unknown} language
 */
export function validateTargetLanguage(language) {
  if (language === undefined || language === null || language === '') {
    return null;
  }

  if (typeof language !== 'string') {
    throw new AppError(ErrorCodes.UNSUPPORTED_LANGUAGE, 'targetLanguage must be a string.', 400);
  }

  const normalized = normalizeLanguageCode(language);
  if (!normalized) {
    throw new AppError(
      ErrorCodes.UNSUPPORTED_LANGUAGE,
      `Unsupported language code: ${language}`,
      400,
    );
  }

  return normalized;
}

/**
 * @param {string} language
 */
export function assertSupportedLanguage(language) {
  if (!isSupportedLanguage(language)) {
    throw new AppError(
      ErrorCodes.UNSUPPORTED_LANGUAGE,
      `Unsupported language code: ${language}`,
      400,
    );
  }
}

/**
 * Magic-byte detection; do not trust client MIME alone.
 *
 * @param {Buffer} buffer
 * @param {string} [fileName]
 * @param {string} [declaredMime]
 */
export function detectFileType(buffer, fileName = '', declaredMime = '') {
  const ext = extensionOf(fileName);

  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: '.jpg', corrupt: false };
  }

  if (
    buffer.length >= 8
    && buffer[0] === 0x89
    && buffer[1] === 0x50
    && buffer[2] === 0x4e
    && buffer[3] === 0x47
  ) {
    return { mimeType: 'image/png', extension: '.png', corrupt: false };
  }

  if (
    buffer.length >= 5
    && buffer[0] === 0x25
    && buffer[1] === 0x50
    && buffer[2] === 0x44
    && buffer[3] === 0x46
  ) {
    // Minimal PDF trailer check
    const asText = buffer.toString('latin1');
    const corrupt = !asText.includes('%%EOF') && buffer.length < 100;
    return { mimeType: 'application/pdf', extension: '.pdf', corrupt };
  }

  // Fallback only when magic bytes fail but extension + declared MIME agree for empty edge cases
  if (declaredMime === 'image/jpeg' && (ext === '.jpg' || ext === '.jpeg')) {
    return { mimeType: 'image/jpeg', extension: '.jpg', corrupt: true };
  }
  if (declaredMime === 'image/png' && ext === '.png') {
    return { mimeType: 'image/png', extension: '.png', corrupt: true };
  }
  if (declaredMime === 'application/pdf' && ext === '.pdf') {
    return { mimeType: 'application/pdf', extension: '.pdf', corrupt: true };
  }

  return null;
}

/**
 * @param {string} name
 */
function extensionOf(name) {
  const idx = name.lastIndexOf('.');
  if (idx < 0) return '';
  return name.slice(idx).toLowerCase();
}

/**
 * @param {string} name
 */
export function sanitizeFileName(name) {
  const base = name.replace(/[/\\?%*:|"<>]/g, '_').trim();
  return base.slice(0, 180) || 'prescription.bin';
}
