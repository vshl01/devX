import type { SarvamLanguageCode } from "@/types/sarvam";

/**
 * The language catalogue. Shared by the client picker and the server
 * translator, so it carries no server-only imports.
 */

export type TranslatableLanguage = Exclude<SarvamLanguageCode, "unknown">;

/** `speech: false` means Sarvam translates it but has no voice for it yet. */
export interface LanguageOption {
  code: TranslatableLanguage;
  label: string;
  native: string;
  speech: boolean;
}

export const LANGUAGES: LanguageOption[] = [
  { code: "en-IN", label: "English", native: "English", speech: true },
  { code: "hi-IN", label: "Hindi", native: "हिन्दी", speech: true },
  { code: "bn-IN", label: "Bengali", native: "বাংলা", speech: true },
  { code: "mr-IN", label: "Marathi", native: "मराठी", speech: true },
  { code: "te-IN", label: "Telugu", native: "తెలుగు", speech: true },
  { code: "ta-IN", label: "Tamil", native: "தமிழ்", speech: true },
  { code: "gu-IN", label: "Gujarati", native: "ગુજરાતી", speech: true },
  { code: "kn-IN", label: "Kannada", native: "ಕನ್ನಡ", speech: true },
  { code: "ml-IN", label: "Malayalam", native: "മലയാളം", speech: true },
  { code: "pa-IN", label: "Punjabi", native: "ਪੰਜਾਬੀ", speech: true },
  { code: "od-IN", label: "Odia", native: "ଓଡ଼ିଆ", speech: true },
  { code: "as-IN", label: "Assamese", native: "অসমীয়া", speech: false },
  { code: "ur-IN", label: "Urdu", native: "اردو", speech: false },
];

export function isTranslatableLanguage(value: string): value is TranslatableLanguage {
  return LANGUAGES.some((language) => language.code === value);
}

export function languageLabel(code: TranslatableLanguage): string {
  return LANGUAGES.find((language) => language.code === code)?.label ?? code;
}

export function canSpeakLanguage(code: TranslatableLanguage): boolean {
  return LANGUAGES.find((language) => language.code === code)?.speech ?? false;
}
