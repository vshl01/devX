import { AppError, ErrorCodes } from '../utils/errors.js';
import { getSarvamClient } from './client.js';
import { isSupportedLanguage, resolveSourceLanguageCode } from './languages.js';

const MAX_INPUT_CHARS = 1800;

/**
 * Translate text with Sarvam Translate API.
 * POST https://api.sarvam.ai/translate
 *
 * @param {{
 *   input: string,
 *   sourceLanguageCode?: string,
 *   targetLanguageCode: string,
 *   model?: 'mayura:v1'|'sarvam-translate:v1',
 * }} params
 * @param {{ client?: import('./client.js').SarvamClient }} [options]
 */
export async function translateText(params, options = {}) {
  const target = params.targetLanguageCode;
  if (!isSupportedLanguage(target)) {
    throw new AppError(
      ErrorCodes.UNSUPPORTED_LANGUAGE,
      `Unsupported target language: ${target}`,
      400,
    );
  }

  const sourceLanguageCode = resolveSourceLanguageCode(params.sourceLanguageCode);
  const input = (params.input || '').trim();
  if (!input) return { translatedText: '', sourceLanguageCode };

  const client = options.client ?? getSarvamClient();
  const chunks = chunkText(input, MAX_INPUT_CHARS);
  const translatedChunks = [];
  let detectedSource = sourceLanguageCode;

  for (const chunk of chunks) {
    const { data } = await client.postJson('/translate', {
      input: chunk,
      source_language_code: sourceLanguageCode,
      target_language_code: target,
      // mayura:v1 supports source_language_code=auto; use it when detecting.
      model: params.model || (sourceLanguageCode === 'auto' ? 'mayura:v1' : 'sarvam-translate:v1'),
      mode: 'formal',
      numerals_format: 'international',
    });

    if (!data || typeof data.translated_text !== 'string') {
      throw new AppError(
        ErrorCodes.SARVAM_TRANSLATION_FAILED,
        'Sarvam translation returned an unexpected response.',
        502,
      );
    }

    translatedChunks.push(data.translated_text);
    if (data.source_language_code) {
      detectedSource = data.source_language_code;
    }
  }

  return {
    translatedText: translatedChunks.join(''),
    sourceLanguageCode: detectedSource,
  };
}

/**
 * Translate only explanatory prescription fields.
 * Preserves medicine names, strengths, doses, frequencies, durations, and vitals.
 *
 * @param {object} canonical
 * @param {string} targetLanguageCode
 * @param {{ sourceLanguageCode?: string, client?: import('./client.js').SarvamClient }} [options]
 */
export async function translateCanonicalPrescription(canonical, targetLanguageCode, options = {}) {
  if (!canonical || typeof canonical !== 'object') {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No prescription data to translate.', 422);
  }

  const translated = structuredClone(canonical);

  if (Array.isArray(translated.diagnosis)) {
    translated.diagnosis = await mapTranslateStrings(
      translated.diagnosis,
      targetLanguageCode,
      options,
    );
  }

  if (Array.isArray(translated.additionalInstructions)) {
    translated.additionalInstructions = await mapTranslateStrings(
      translated.additionalInstructions,
      targetLanguageCode,
      options,
    );
  }

  if (translated.followUp && typeof translated.followUp === 'object') {
    if (typeof translated.followUp.instructions === 'string' && translated.followUp.instructions) {
      const result = await translateText(
        {
          input: translated.followUp.instructions,
          sourceLanguageCode: options.sourceLanguageCode || 'auto',
          targetLanguageCode,
        },
        { client: options.client },
      );
      translated.followUp.instructions = result.translatedText;
    }
  }

  if (Array.isArray(translated.medications)) {
    for (const med of translated.medications) {
      if (!med || typeof med !== 'object') continue;
      if (typeof med.instructions === 'string' && med.instructions) {
        const result = await translateText(
          {
            input: med.instructions,
            sourceLanguageCode: options.sourceLanguageCode || 'auto',
            targetLanguageCode,
          },
          { client: options.client },
        );
        med.instructions = result.translatedText;
      }
      if (typeof med.timing === 'string' && med.timing) {
        const result = await translateText(
          {
            input: med.timing,
            sourceLanguageCode: options.sourceLanguageCode || 'auto',
            targetLanguageCode,
          },
          { client: options.client },
        );
        med.timing = result.translatedText;
      }
      // Preserve name, strength, form, dose, frequency, duration.
    }
  }

  if (Array.isArray(translated.tests)) {
    for (const test of translated.tests) {
      if (!test || typeof test !== 'object') continue;
      if (typeof test.instructions === 'string' && test.instructions) {
        const result = await translateText(
          {
            input: test.instructions,
            sourceLanguageCode: options.sourceLanguageCode || 'auto',
            targetLanguageCode,
          },
          { client: options.client },
        );
        test.instructions = result.translatedText;
      }
    }
  }

  return translated;
}

/**
 * @param {unknown[]} values
 * @param {string} targetLanguageCode
 * @param {{ sourceLanguageCode?: string, client?: import('./client.js').SarvamClient }} options
 */
async function mapTranslateStrings(values, targetLanguageCode, options) {
  const out = [];
  for (const value of values) {
    if (typeof value !== 'string' || !value.trim()) {
      out.push(value);
      continue;
    }
    const result = await translateText(
      {
        input: value,
        sourceLanguageCode: options.sourceLanguageCode || 'auto',
        targetLanguageCode,
      },
      { client: options.client },
    );
    out.push(result.translatedText);
  }
  return out;
}

/**
 * @param {string} text
 * @param {number} maxChars
 * @returns {string[]}
 */
function chunkText(text, maxChars) {
  if (text.length <= maxChars) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > maxChars) {
    let splitAt = remaining.lastIndexOf(' ', maxChars);
    if (splitAt < maxChars * 0.5) splitAt = maxChars;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
