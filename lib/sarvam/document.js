import { AppError, ErrorCodes } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import { getSarvamClient } from './client.js';

const TERMINAL_STATUSES = new Set([
  'completed',
  'partially_completed',
  'failed',
  'rejected',
]);

const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_POLL_TIMEOUT_MS = 120_000;

/**
 * @param {number} ms
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a digitise job for a prescription document.
 * Uses Sarvam DocAI: POST /doc-ai/v1/job/digitise
 *
 * @param {{
 *   buffer: Buffer,
 *   fileName: string,
 *   mimeType: string,
 *   language?: string,
 *   contentType?: 'printed'|'handwritten'|'mixed',
 *   outputFormat?: 'html'|'md',
 * }} input
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function createDigitiseJob(input, options = {}) {
  const client = options.client ?? getSarvamClient();
  const form = new FormData();
  const file = new File([new Uint8Array(input.buffer)], input.fileName, {
    type: input.mimeType,
  });
  form.append('file', file);
  form.append('language', input.language || 'en-IN');
  form.append('output_format', input.outputFormat || 'md');
  form.append('content_type', input.contentType || 'handwritten');
  form.append('auto_orient', 'true');
  form.append('model', 'sarvam-vision-v1');

  const { data } = await client.postForm('/doc-ai/v1/job/digitise', form);

  if (!data?.job_id) {
    throw new AppError(
      ErrorCodes.SARVAM_DOCUMENT_PROCESSING_FAILED,
      'Sarvam digitise job did not return a job ID.',
      502,
    );
  }

  logger.info('sarvam_digitise_started', {
    operation: 'digitise',
    sarvamJobId: data.job_id,
    status: data.status,
  });

  return {
    jobId: data.job_id,
    status: data.status,
    runId: data.run_id,
  };
}

/**
 * @param {string} jobId
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function getJobStatus(jobId, options = {}) {
  const client = options.client ?? getSarvamClient();
  const { data } = await client.get(`/doc-ai/v1/job/${encodeURIComponent(jobId)}/status`);
  return data;
}

/**
 * @param {string} jobId
 * @param {{ format?: string, client?: import('./client.js').SarvamClient }} [options]
 */
export async function getJobResults(jobId, options = {}) {
  const client = options.client ?? getSarvamClient();
  const format = options.format || 'json';
  const { data } = await client.get(
    `/doc-ai/v1/job/${encodeURIComponent(jobId)}/results?format=${encodeURIComponent(format)}`,
  );
  return data;
}

/**
 * Poll until the job reaches a terminal status.
 *
 * @param {string} jobId
 * @param {{
 *   intervalMs?: number,
 *   timeoutMs?: number,
 *   client?: import('./client.js').SarvamClient,
 *   onPoll?: (status: unknown) => void,
 * }} [options]
 */
export async function waitForJob(jobId, options = {}) {
  const intervalMs = options.intervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const timeoutMs = options.timeoutMs ?? DEFAULT_POLL_TIMEOUT_MS;
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    const status = await getJobStatus(jobId, { client: options.client });
    options.onPoll?.(status);

    const current = String(status?.status || '').toLowerCase();
    if (TERMINAL_STATUSES.has(current)) {
      return status;
    }

    await sleep(intervalMs);
  }

  throw new AppError(
    ErrorCodes.SARVAM_DOCUMENT_PROCESSING_FAILED,
    'Timed out waiting for Sarvam document processing.',
    504,
  );
}

/**
 * Digitize a document and return raw text + raw provider payload.
 *
 * @param {{
 *   buffer: Buffer,
 *   fileName: string,
 *   mimeType: string,
 *   language?: string,
 *   contentType?: 'printed'|'handwritten'|'mixed',
 * }} input
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function digitiseDocument(input, options = {}) {
  const started = await createDigitiseJob(input, options);
  const terminal = await waitForJob(started.jobId, {
    client: options.client,
  });

  const terminalStatus = String(terminal?.status || '').toLowerCase();
  if (terminalStatus === 'failed' || terminalStatus === 'rejected') {
    throw new AppError(
      ErrorCodes.SARVAM_DOCUMENT_PROCESSING_FAILED,
      'Unable to process the prescription document.',
      502,
    );
  }

  const results = await getJobResults(started.jobId, {
    format: 'json',
    client: options.client,
  });

  const rawText = extractDigitisedText(results);

  return {
    jobId: started.jobId,
    status: terminalStatus,
    rawText,
    rawResult: results,
  };
}

/**
 * Flatten digitise results into plain text without inventing content.
 *
 * @param {unknown} results
 * @returns {string}
 */
export function extractDigitisedText(results) {
  if (!results || typeof results !== 'object') return '';

  const docs = /** @type {{ documents?: unknown }} */ (results).documents;
  if (!Array.isArray(docs)) return '';

  const parts = [];
  for (const doc of docs) {
    if (!doc || typeof doc !== 'object') continue;
    const pages = /** @type {{ pages?: unknown }} */ (doc).pages;
    if (!Array.isArray(pages)) continue;
    for (const page of pages) {
      if (!page || typeof page !== 'object') continue;
      const content = /** @type {{ content?: unknown }} */ (page).content;
      if (typeof content === 'string' && content.trim()) {
        parts.push(content.trim());
      }
    }
  }

  return parts.join('\n\n');
}
