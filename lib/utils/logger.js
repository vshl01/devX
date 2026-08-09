/**
 * Structured logger. Never log API keys, auth headers, or full medical documents.
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {string} message
 * @param {Record<string, unknown>} [fields]
 */
function write(level, message, fields = {}) {
  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...sanitize(fields),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else if (level === 'warn') {
    console.warn(line);
  } else {
    console.log(line);
  }
}

/**
 * @param {Record<string, unknown>} fields
 */
function sanitize(fields) {
  const blocked = new Set([
    'authorization',
    'api-subscription-key',
    'apiKey',
    'api_key',
    'SARVAM_API_KEY',
    'rawText',
    'rawDigitisedText',
    'structuredData',
    'translatedData',
    'fileBuffer',
  ]);

  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, value] of Object.entries(fields)) {
    if (blocked.has(key)) {
      out[key] = '[redacted]';
      continue;
    }
    out[key] = value;
  }
  return out;
}

export const logger = {
  debug: (message, fields) => write('debug', message, fields),
  info: (message, fields) => write('info', message, fields),
  warn: (message, fields) => write('warn', message, fields),
  error: (message, fields) => write('error', message, fields),
};

/**
 * @returns {string}
 */
export function createRequestId() {
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
