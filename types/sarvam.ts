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
  | "te-IN";

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
