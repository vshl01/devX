/**
 * Typed request/response shapes for the Sarvam APIs we call.
 * Source: https://docs.sarvam.ai/api-reference-docs
 */

/* -------------------------------------------------------------------------- */
/* Speech to text                                                             */
/* -------------------------------------------------------------------------- */

/** BCP-47 codes Sarvam accepts. `unknown` asks Sarvam to auto-detect. */
export type SarvamLanguageCode =
  | "unknown"
  | "en-IN"
  | "hi-IN"
  | "bn-IN"
  | "gu-IN"
  | "kn-IN"
  | "ml-IN"
  | "mr-IN"
  | "od-IN"
  | "pa-IN"
  | "ta-IN"
  | "te-IN"
  | "as-IN"
  | "ur-IN";

export type SarvamSttModel = "saaras:v3" | "saaras:v4";

export interface SarvamSttRequest {
  /** Mono 16 kHz WAV segment. */
  audio: Blob;
  /** Filename sent in the multipart part. Sarvam uses it to sniff the codec. */
  filename?: string;
  model?: SarvamSttModel;
  languageCode?: SarvamLanguageCode;
}

export interface SarvamSttResponse {
  request_id: string | null;
  transcript: string;
  language_code: string | null;
  language_probability?: number;
}

/* -------------------------------------------------------------------------- */
/* Chat completions                                                           */
/* -------------------------------------------------------------------------- */

export type SarvamChatModel = "sarvam-105b-conversations" | "sarvam-105b";

export type SarvamContentPart =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface SarvamChatMessage {
  role: "system" | "user" | "assistant";
  content: string | SarvamContentPart[];
}

export interface SarvamChatRequest {
  messages: SarvamChatMessage[];
  model?: SarvamChatModel;
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface SarvamChatChoice {
  index: number;
  message: { role: "assistant"; content: string | null };
  finish_reason: string | null;
}

export interface SarvamChatResponse {
  id: string;
  model: string;
  choices: SarvamChatChoice[];
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/** One `data:` frame of a `stream: true` completion. */
export interface SarvamChatStreamChunk {
  id: string;
  choices: Array<{
    index: number;
    delta: { role?: string; content?: string | null };
    finish_reason: string | null;
  }>;
}

/* -------------------------------------------------------------------------- */
/* Errors                                                                     */
/* -------------------------------------------------------------------------- */

export type SarvamErrorCode =
  | "missing_key"
  | "unauthorized"
  | "rate_limited"
  | "unsupported_input"
  | "upstream_error"
  | "network_error";

export class SarvamError extends Error {
  readonly code: SarvamErrorCode;
  readonly status: number;

  constructor(code: SarvamErrorCode, message: string, status = 502) {
    super(message);
    this.name = "SarvamError";
    this.code = code;
    this.status = status;
  }
}

/* -------------------------------------------------------------------------- */
/* Document AI (OCR and digitisation)                                         */
/* -------------------------------------------------------------------------- */

export type DocAiJobState =
  | "Accepted"
  | "Pending"
  | "Running"
  | "Completed"
  | "PartiallyCompleted"
  | "Failed";

export interface DocAiJobParameters {
  /** Primary language on the page. Sarvam still reads mixed-script documents. */
  language: SarvamLanguageCode;
  output_format: "md" | "html";
}

export interface DocAiJob {
  job_id: string;
  job_state: DocAiJobState;
  job_parameters?: DocAiJobParameters;
  error_code?: string | null;
  error_message?: string | null;
}

/** `upload_urls` and `download_urls` are keyed by filename. */
export interface DocAiFileLinks {
  job_id: string;
  job_state: DocAiJobState;
  upload_urls?: Record<string, { file_url: string }>;
  download_urls?: Record<string, { file_url: string }>;
  error_code?: string | null;
  error_message?: string | null;
}

/* -------------------------------------------------------------------------- */
/* Translation                                                                */
/* -------------------------------------------------------------------------- */

export type SarvamTranslateModel = "sarvam-translate:v1" | "mayura:v1";

export interface SarvamTranslateRequest {
  input: string;
  source_language_code: SarvamLanguageCode | "auto";
  target_language_code: Exclude<SarvamLanguageCode, "unknown">;
  model?: SarvamTranslateModel;
  mode?: "formal" | "modern-colloquial" | "classic-colloquial" | "code-mixed";
  numerals_format?: "international" | "native";
}

export interface SarvamTranslateResponse {
  request_id: string | null;
  translated_text: string;
  source_language_code: string | null;
}

/* -------------------------------------------------------------------------- */
/* Text to speech                                                             */
/* -------------------------------------------------------------------------- */

export type SarvamTtsModel = "bulbul:v2" | "bulbul:v3";

export interface SarvamTtsRequest {
  text: string;
  /** Must be one of `SPEECH_LANGUAGES`; the rest have no voice. */
  languageCode: string;
  speaker?: string;
  pace?: number;
}

export interface SarvamTtsResponse {
  request_id: string | null;
  /** Base64 audio, one entry per input. */
  audios: string[];
}
