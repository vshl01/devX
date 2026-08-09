import { AppError, ErrorCodes } from '../utils/errors.js';
import { getSarvamClient } from './client.js';
import { isSupportedLanguage, resolveSourceLanguageCode } from './languages.js';
import {
  applyTranslations,
  buildStructuredPresentation,
  collectTranslatableStrings,
  createPresentationTranslation,
} from '../prescriptions/presentation.js';

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
    translatedText: translatedChunks.join('\n'),
    sourceLanguageCode: detectedSource,
  };
}

/**
 * Translate the structured prescription presentation via Sarvam while preserving
 * the same section/card layout as the Original UI.
 *
 * Always builds from canonical structuredData (never from a prior translation).
 *
 * @param {object} canonical
 * @param {string} targetLanguageCode
 * @param {{ sourceLanguageCode?: string, client?: import('./client.js').SarvamClient }} [options]
 */
export async function translateCanonicalPrescription(canonical, targetLanguageCode, options = {}) {
  if (!canonical || typeof canonical !== 'object') {
    throw new AppError(ErrorCodes.VALIDATION_ERROR, 'No prescription data to translate.', 422);
  }

  const structured = buildStructuredPresentation(canonical);
  if (!structured) {
    throw new AppError(
      ErrorCodes.VALIDATION_ERROR,
      'Prescription has no content available to translate.',
      422,
    );
  }

  const { labels, values } = collectTranslatableStrings(structured);
  const sourceLanguageCode = options.sourceLanguageCode || 'auto';

  const [labelMap, valueMap] = await Promise.all([
    translateStringList(labels, targetLanguageCode, sourceLanguageCode, options),
    translateStringList(values, targetLanguageCode, sourceLanguageCode, options),
  ]);

  const translated = applyTranslations(structured, labelMap, valueMap);

  return createPresentationTranslation(translated.sections, targetLanguageCode);
}

/**
 * Translate a list of strings via Sarvam — one string per request.
 *
 * Numbered batching is unsafe: Sarvam often returns one line like
 * "1. Patient 2. Name 3. Age…", which then poisons the first map entry
 * (section titles / first duration) with the entire list.
 *
 * @param {string[]} items
 * @param {string} targetLanguageCode
 * @param {string} sourceLanguageCode
 * @param {{ client?: import('./client.js').SarvamClient }} options
 * @returns {Promise<Map<string, string>>}
 */
async function translateStringList(items, targetLanguageCode, sourceLanguageCode, options) {
  /** @type {Map<string, string>} */
  const map = new Map();
  if (!items.length) return map;

  const unique = [...new Set(items.map((item) => item.trim()).filter(Boolean))];
  const CONCURRENCY = 6;

  for (let i = 0; i < unique.length; i += CONCURRENCY) {
    const slice = unique.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      slice.map(async (original) => {
        try {
          const result = await translateText(
            {
              input: original,
              sourceLanguageCode,
              targetLanguageCode,
              model: 'mayura:v1',
            },
            { client: options.client },
          );
          const translated = (result.translatedText || '').trim();
          if (!translated || isCorruptedBatchTranslation(original, translated)) {
            return [original, original];
          }
          return [original, translated];
        } catch {
          return [original, original];
        }
      }),
    );

    for (const [original, translated] of results) {
      map.set(original, translated);
    }
  }

  return map;
}

/**
 * Detect when a single-field translation actually contains a merged numbered list.
 *
 * @param {string} original
 * @param {string} translated
 */
function isCorruptedBatchTranslation(original, translated) {
  const markers = translated.match(/(?:^|\s)\d+\.\s/g) || [];
  const originalMarkers = original.match(/(?:^|\s)\d+\.\s/g) || [];
  if (markers.length >= 2 && originalMarkers.length < 2) return true;
  if (original.length <= 48 && translated.length > Math.max(80, original.length * 10)) {
    return true;
  }
  return false;
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
    let splitAt = remaining.lastIndexOf('\n', maxChars);
    if (splitAt < maxChars * 0.4) {
      splitAt = remaining.lastIndexOf(' ', maxChars);
    }
    if (splitAt < maxChars * 0.4) splitAt = maxChars;
    chunks.push(remaining.slice(0, splitAt));
    remaining = remaining.slice(splitAt).trimStart();
  }
  if (remaining) chunks.push(remaining);
  return chunks;
}
