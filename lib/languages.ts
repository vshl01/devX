import type { SarvamLanguageCode } from "@/types/sarvam";

/**
 * The language catalogue. Shared by the client picker and the server
 * translator, so it carries no server-only imports.
 */

export type TranslatableLanguage = Exclude<SarvamLanguageCode, "unknown">;

export const LANGUAGES: Array<{ code: TranslatableLanguage; label: string; native: string }> = [
  { code: "en-IN", label: "English", native: "English" },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी" },
  { code: "bn-IN", label: "Bengali", native: "বাংলা" },
  { code: "mr-IN", label: "Marathi", native: "मराठी" },
  { code: "te-IN", label: "Telugu", native: "తెలుగు" },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்" },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી" },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ" },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം" },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ" },
  { code: "od-IN", label: "Odia", native: "ଓଡ଼ିଆ" },
  { code: "as-IN", label: "Assamese", native: "অসমীয়া" },
  { code: "ur-IN", label: "Urdu", native: "اردو" },
];

export function isTranslatableLanguage(value: string): value is TranslatableLanguage {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageLabel(code: TranslatableLanguage): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? code;
}
