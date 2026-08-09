import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

const DEFAULT_BASE_URL = 'https://api.sarvam.ai';
const DEFAULT_TIMEOUT_MS = 60_000;
const MAX_RETRIES = 3;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 504]);

/**
 * @returns {string}
 */
export function getSarvamApiKey() {
  const key = process.env.SARVAM_API_KEY;
  if (!key) {
    throw new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'SARVAM_API_KEY is not configured.',
      503,
    );
  }
  return key;
}

/**
 * @returns {string}
 */
export function getSarvamBaseUrl() {
  return (process.env.SARVAM_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
}

/**
 * @param {number} attempt
 */
function backoffMs(attempt) {
  return Math.min(1000 * 2 ** attempt, 8000) + Math.floor(Math.random() * 250);
}

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Low-level Sarvam HTTP client with auth, timeout, and bounded retries.
 */
export class SarvamClient {
  /**
   * @param {{ apiKey?: string, baseUrl?: string, timeoutMs?: number }} [options]
   */
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? getSarvamApiKey();
    this.baseUrl = options.baseUrl ?? getSarvamBaseUrl();
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  /**
   * @param {string} path
   * @param {RequestInit & { retry?: boolean, parseJson?: boolean }} [options]
   */
  async request(path, options = {}) {
    const {
      retry = true,
      parseJson = true,
      headers = {},
      ...init
    } = options;

    const url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;
    const requestId = `sarvam_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    const maxAttempts = retry ? MAX_RETRIES : 1;

    let lastError;

    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      const started = Date.now();

      try {
        const response = await fetch(url, {
          ...init,
          signal: controller.signal,
          headers: {
            'api-subscription-key': this.apiKey,
            ...headers,
          },
        });

        const durationMs = Date.now() - started;
        const bodyText = await response.text();
        let body = null;
        if (parseJson && bodyText) {
          try {
            body = JSON.parse(bodyText);
          } catch {
            body = bodyText;
          }
        } else {
          body = bodyText;
        }

        if (!response.ok) {
          const retryable = RETRYABLE_STATUSES.has(response.status);
          logger.warn('sarvam_http_error', {
            requestId,
            path,
            status: response.status,
            attempt: attempt + 1,
            durationMs,
            retryable,
          });

          if (retryable && attempt < maxAttempts - 1) {
            await sleep(backoffMs(attempt));
            continue;
          }

          throw normalizeSarvamHttpError(response.status, body);
        }

        logger.info('sarvam_http_ok', {
          requestId,
          path,
          status: response.status,
          attempt: attempt + 1,
          durationMs,
        });

        return { status: response.status, data: body, headers: response.headers };
      } catch (error) {
        lastError = error;
        const isAbort = error instanceof Error && error.name === 'AbortError';
        const isNetwork = error instanceof TypeError;
        const canRetry = (isAbort || isNetwork) && attempt < maxAttempts - 1;

        logger.warn('sarvam_request_exception', {
          requestId,
          path,
          attempt: attempt + 1,
          message: error instanceof Error ? error.message : 'unknown',
          canRetry,
        });

        if (canRetry) {
          await sleep(backoffMs(attempt));
          continue;
        }

        if (isAppLike(error)) throw error;

        throw new AppError(
          ErrorCodes.SARVAM_REQUEST_FAILED,
          isAbort
            ? 'Sarvam AI request timed out.'
            : 'Unable to reach Sarvam AI.',
          502,
        );
      } finally {
        clearTimeout(timer);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new AppError(ErrorCodes.SARVAM_REQUEST_FAILED, 'Sarvam AI request failed.', 502);
  }

  /**
   * @param {string} path
   * @param {unknown} body
   * @param {RequestInit & { retry?: boolean }} [options]
   */
  postJson(path, body, options = {}) {
    return this.request(path, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
      body: JSON.stringify(body),
      ...options,
    });
  }

  /**
   * @param {string} path
   * @param {FormData} formData
   * @param {RequestInit & { retry?: boolean }} [options]
   */
  postForm(path, formData, options = {}) {
    return this.request(path, {
      method: 'POST',
      body: formData,
      // Let fetch set multipart boundary; do not set Content-Type manually.
      retry: false,
      ...options,
    });
  }

  /**
   * @param {string} path
   * @param {RequestInit & { retry?: boolean }} [options]
   */
  get(path, options = {}) {
    return this.request(path, {
      method: 'GET',
      ...options,
    });
  }
}

/**
 * @param {number} status
 * @param {unknown} body
 */
function normalizeSarvamHttpError(status, body) {
  const providerMessage =
    body && typeof body === 'object' && body !== null && 'error' in body
      ? /** @type {{ error?: { message?: string, code?: string } }} */ (body).error?.message
      : typeof body === 'string'
        ? body.slice(0, 200)
        : undefined;

  if (status === 403) {
    return new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'Sarvam AI rejected the request (authentication or permission).',
      502,
    );
  }

  if (status === 413) {
    return new AppError(
      ErrorCodes.PAYLOAD_TOO_LARGE,
      'The prescription file exceeds Sarvam AI size limits.',
      413,
    );
  }

  if (status === 429) {
    return new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'Sarvam AI rate limit exceeded. Please try again shortly.',
      429,
    );
  }

  return new AppError(
    ErrorCodes.SARVAM_REQUEST_FAILED,
    providerMessage
      ? `Sarvam AI request failed: ${providerMessage}`
      : 'Sarvam AI request failed.',
    status >= 500 ? 502 : 502,
  );
}

/**
 * @param {unknown} error
 */
function isAppLike(error) {
  return error instanceof AppError;
}

let defaultClient;

/**
 * @returns {SarvamClient}
 */
export function getSarvamClient() {
  if (!defaultClient) {
    defaultClient = new SarvamClient();
  }
  return defaultClient;
}
