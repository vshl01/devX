import { AppError, ErrorCodes } from '../utils/errors.js';
import { isSupportedLanguage } from './languages.js';
import { getSarvamClient } from './client.js';

/**
 * Sarvam Bulbul text-to-speech.
 * POST https://api.sarvam.ai/text-to-speech
 *
 * @param {{
 *   text: string,
 *   targetLanguageCode: string,
 *   speaker?: string,
 *   model?: string,
 * }} params
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 * @returns {Promise<{ audioBase64: string, mimeType: string, targetLanguageCode: string }>}
 */
export async function synthesizeSpeech(params, options = {}) {
  const text = typeof params.text === 'string' ? params.text.trim() : '';
  if (!text) {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'TTS text is required.', 400);
  }

  const targetLanguageCode = params.targetLanguageCode;
  if (!isSupportedLanguage(targetLanguageCode)) {
    throw new AppError(
      ErrorCodes.UNSUPPORTED_LANGUAGE,
      `Unsupported TTS language: ${targetLanguageCode}`,
      400,
    );
  }

  // Bulbul REST limit ~2500 chars for v3
  const clipped = text.slice(0, 2400);
  const client = options.client ?? getSarvamClient();

  const { data } = await client.postJson('/text-to-speech', {
    text: clipped,
    target_language_code: targetLanguageCode,
    model: params.model || 'bulbul:v3',
    speaker: params.speaker || 'shubh',
    pace: 1.0,
    speech_sample_rate: 22050,
    enable_preprocessing: true,
  });

  const audioBase64 = extractAudioBase64(data);
  if (!audioBase64) {
    throw new AppError(
      ErrorCodes.SARVAM_REQUEST_FAILED,
      'Sarvam TTS returned no audio.',
      502,
    );
  }

  return {
    audioBase64,
    mimeType: 'audio/wav',
    targetLanguageCode,
  };
}

/**
 * @param {unknown} data
 * @returns {string | null}
 */
function extractAudioBase64(data) {
  if (!data || typeof data !== 'object') return null;
  const row = /** @type {Record<string, unknown>} */ (data);
  if (typeof row.audio === 'string' && row.audio) return row.audio;
  if (Array.isArray(row.audios) && typeof row.audios[0] === 'string') return row.audios[0];
  return null;
}
