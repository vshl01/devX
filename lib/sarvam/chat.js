import { AppError, ErrorCodes } from '../utils/errors.js';
import { getSarvamClient } from './client.js';

/**
 * Sarvam Chat Completions (non-streaming).
 * POST https://api.sarvam.ai/v1/chat/completions
 *
 * @param {{
 *   messages: Array<{ role: string, content: string }>,
 *   model?: string,
 *   temperature?: number,
 *   maxTokens?: number,
 * }} params
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function chatCompletion(params, options = {}) {
  const messages = Array.isArray(params.messages) ? params.messages : [];
  if (!messages.length) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'Chat messages are required.', 400);
  }

  const client = options.client ?? getSarvamClient();
  const { data } = await client.postJson('/v1/chat/completions', {
    model: params.model || 'sarvam-m',
    messages,
    temperature: params.temperature ?? 0.1,
    max_tokens: params.maxTokens ?? 400,
    stream: false,
  });

  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) {
    throw new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'Sarvam chat returned an empty response.',
      502,
    );
  }

  return {
    content: content.trim(),
    model: data?.model ?? null,
    raw: data,
  };
}

/**
 * Extract a JSON object from a model response that may include markdown fences.
 *
 * @param {string} text
 * @returns {unknown}
 */
export function parseJsonFromModel(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced?.[1]) {
      return JSON.parse(fenced[1].trim());
    }
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start >= 0 && end > start) {
      return JSON.parse(trimmed.slice(start, end + 1));
    }
    throw new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'Sarvam chat did not return valid JSON.',
      502,
    );
  }
}
