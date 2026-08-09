/**
 * Central language configuration for Sarvam-supported Indian languages.
 * Source: https://docs.sarvam.ai/api-reference/text/translate-text
 */

export const SARVAM_LANGUAGE_CODES = Object.freeze([
  'bn-IN',
  'en-IN',
  'gu-IN',
  'hi-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'od-IN',
  'pa-IN',
  'ta-IN',
  'te-IN',
  'as-IN',
  'brx-IN',
  'doi-IN',
  'kok-IN',
  'ks-IN',
  'mai-IN',
  'mni-IN',
  'ne-IN',
  'sa-IN',
  'sat-IN',
  'sd-IN',
  'ur-IN',
]);

/** Minimum languages required by the product guide. */
export const PRIMARY_TARGET_LANGUAGES = Object.freeze([
  'en-IN',
  'hi-IN',
  'kn-IN',
  'ta-IN',
  'te-IN',
  'ml-IN',
]);

const LANGUAGE_SET = new Set(SARVAM_LANGUAGE_CODES);

/** Common free-form / short labels → Sarvam BCP-47 codes. */
const LANGUAGE_ALIASES = Object.freeze({
  auto: 'auto',
  en: 'en-IN',
  english: 'en-IN',
  hi: 'hi-IN',
  hindi: 'hi-IN',
  bn: 'bn-IN',
  bengali: 'bn-IN',
  gu: 'gu-IN',
  gujarati: 'gu-IN',
  kn: 'kn-IN',
  kannada: 'kn-IN',
  ml: 'ml-IN',
  malayalam: 'ml-IN',
  mr: 'mr-IN',
  marathi: 'mr-IN',
  od: 'od-IN',
  or: 'od-IN',
  odia: 'od-IN',
  oriya: 'od-IN',
  pa: 'pa-IN',
  punjabi: 'pa-IN',
  ta: 'ta-IN',
  tamil: 'ta-IN',
  te: 'te-IN',
  telugu: 'te-IN',
  as: 'as-IN',
  assamese: 'as-IN',
  ur: 'ur-IN',
  urdu: 'ur-IN',
  ne: 'ne-IN',
  nepali: 'ne-IN',
  sa: 'sa-IN',
  sanskrit: 'sa-IN',
});

/**
 * @param {string | null | undefined} code
 * @returns {boolean}
 */
export function isSupportedLanguage(code) {
  return typeof code === 'string' && LANGUAGE_SET.has(code);
}

/**
 * @param {string | null | undefined} code
 * @returns {boolean}
 */
export function isValidTranslateSourceLanguage(code) {
  return code === 'auto' || isSupportedLanguage(code);
}

/**
 * @param {string | null | undefined} code
 * @returns {string | null}
 */
export function normalizeLanguageCode(code) {
  if (!code || typeof code !== 'string') return null;
  const trimmed = code.trim();
  return isSupportedLanguage(trimmed) ? trimmed : null;
}

/**
 * Resolve a possibly free-form language label into a Sarvam translate source code.
 * Falls back to `auto` when the value is missing or unrecognized.
 *
 * @param {string | null | undefined} code
 * @returns {'auto' | string}
 */
export function resolveSourceLanguageCode(code) {
  if (!code || typeof code !== 'string') return 'auto';

  const trimmed = code.trim();
  if (!trimmed) return 'auto';
  if (isValidTranslateSourceLanguage(trimmed)) return trimmed;

  const alias = LANGUAGE_ALIASES[trimmed.toLowerCase()];
  if (alias) return alias;

  // Handle values like "en-in" / "EN-IN"
  const lower = trimmed.toLowerCase();
  const matched = SARVAM_LANGUAGE_CODES.find((item) => item.toLowerCase() === lower);
  if (matched) return matched;

  return 'auto';
}
