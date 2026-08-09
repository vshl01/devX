import "server-only";

import type {
  DocAiFileLinks,
  DocAiJob,
  DocAiJobParameters,
  SarvamChatMessage,
  SarvamChatRequest,
  SarvamChatResponse,
  SarvamChatStreamChunk,
  SarvamSttRequest,
  SarvamSttResponse,
  SarvamTranslateRequest,
  SarvamTranslateResponse,
} from "@/types/sarvam";
import { SarvamError } from "@/types/sarvam";

/**
 * Every call to Sarvam goes through this module. It runs on the server only,
 * so `SARVAM_API_KEY` is never part of a client bundle.
 */

const BASE_URL = process.env.SARVAM_BASE_URL ?? "https://api.sarvam.ai";
const STT_TIMEOUT_MS = 20_000;
const CHAT_TIMEOUT_MS = 60_000;

function apiKey(): string {
  // `SARVAM_AI` is accepted as an alias so an existing .env keeps working.
  const key = process.env.SARVAM_API_KEY ?? process.env.SARVAM_AI;
  if (!key) {
    throw new SarvamError(
      "missing_key",
      "SARVAM_API_KEY is not set. Add it to .env.local.",
      500,
    );
  }
  return key;
}

function authHeaders(): Record<string, string> {
  const key = apiKey();
  return {
    "api-subscription-key": key,
    // Accepted alongside the subscription key for OpenAI-compatible tooling.
    Authorization: `Bearer ${key}`,
  };
}

async function failFromResponse(response: Response): Promise<never> {
  const body = await response.text().catch(() => "");
  const detail = body.slice(0, 400) || response.statusText;

  if (response.status === 401 || response.status === 403) {
    throw new SarvamError("unauthorized", "Sarvam rejected the API key.", 502);
  }
  if (response.status === 429) {
    throw new SarvamError(
      "rate_limited",
      "Sarvam rate limit reached. Try again shortly.",
      429,
    );
  }
  if (response.status === 415 || response.status === 422) {
    throw new SarvamError("unsupported_input", detail, 415);
  }
  throw new SarvamError("upstream_error", detail, 502);
}

function asNetworkError(cause: unknown): never {
  if (cause instanceof SarvamError) throw cause;
  const message =
    cause instanceof Error && cause.name === "TimeoutError"
      ? "Sarvam did not respond in time."
      : "Could not reach Sarvam.";
  throw new SarvamError("network_error", message, 504);
}

/* -------------------------------------------------------------------------- */
/* Speech to text                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Transcribes one audio segment. The composer sends short 16 kHz mono WAV
 * segments cut on silence, so the transcript lands in the input while the user
 * is still speaking.
 */
export async function transcribe({
  audio,
  filename = "segment.wav",
  model = "saaras:v3",
  languageCode = "unknown",
}: SarvamSttRequest): Promise<SarvamSttResponse> {
  const form = new FormData();
  form.append("file", audio, filename);
  form.append("model", model);
  form.append("language_code", languageCode);

  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/speech-to-text`, {
      method: "POST",
      headers: authHeaders(),
      body: form,
      signal: AbortSignal.timeout(STT_TIMEOUT_MS),
    });
  } catch (cause) {
    asNetworkError(cause);
  }

  if (!response.ok) await failFromResponse(response);

  const data = (await response.json()) as Partial<SarvamSttResponse>;
  return {
    request_id: data.request_id ?? null,
    transcript: (data.transcript ?? "").trim(),
    language_code: data.language_code ?? null,
    language_probability: data.language_probability,
  };
}

/* -------------------------------------------------------------------------- */
/* Chat completions                                                           */
/* -------------------------------------------------------------------------- */

export const HEALTH_COACH_SYSTEM_PROMPT = [
  "You are the reading assistant inside Lucid, a health app that helps people understand their own medical reports.",
  "You explain results in plain language: what a marker measures, what the person's value suggests, and which questions are worth raising with their clinician.",
  "Rules you never break:",
  "1. You do not diagnose, prescribe, or tell anyone to start, stop or change a medication or treatment.",
  "2. If a value or symptom suggests urgency (chest pain, breathlessness, severe bleeding, stroke signs, very abnormal results), say so first and tell the person to seek care now.",
  "3. If the report text is missing or unreadable, say what you could not read instead of guessing numbers.",
  "4. Reply in the language the person used.",
  "Style: short paragraphs, no headings, no markdown tables, under 180 words. Close with one specific question they could ask their doctor.",
].join(" ");

function chatBody(request: SarvamChatRequest) {
  return JSON.stringify({
    model: request.model ?? "sarvam-105b-conversations",
    messages: request.messages,
    temperature: request.temperature ?? 0.3,
    max_tokens: request.max_tokens ?? 700,
    stream: request.stream ?? false,
  });
}

async function postChat(request: SarvamChatRequest): Promise<Response> {
  try {
    return await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: chatBody(request),
      signal: AbortSignal.timeout(CHAT_TIMEOUT_MS),
    });
  } catch (cause) {
    asNetworkError(cause);
  }
}

export async function chat(
  request: SarvamChatRequest,
): Promise<SarvamChatResponse> {
  const response = await postChat({ ...request, stream: false });
  if (!response.ok) await failFromResponse(response);
  return (await response.json()) as SarvamChatResponse;
}

/**
 * Streams a completion as plain UTF-8 text deltas. The route handler pipes the
 * result straight to the browser, so the client never parses SSE.
 */
export async function streamChat(
  request: SarvamChatRequest,
): Promise<ReadableStream<Uint8Array>> {
  const response = await postChat({ ...request, stream: true });
  if (!response.ok) await failFromResponse(response);
  if (!response.body) {
    throw new SarvamError("upstream_error", "Sarvam returned an empty stream.");
  }

  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return response.body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        buffer += decoder.decode(chunk, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          for (const line of frame.split("\n")) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;

            try {
              const parsed = JSON.parse(payload) as SarvamChatStreamChunk;
              const delta = parsed.choices?.[0]?.delta?.content;
              if (delta) controller.enqueue(encoder.encode(delta));
            } catch {
              // A partial frame at the tail of a chunk. The next chunk completes it.
            }
          }
        }
      },
    }),
  );
}

/* -------------------------------------------------------------------------- */
/* Message construction                                                       */
/* -------------------------------------------------------------------------- */

export interface CoachTurnInput {
  question: string;
  report?: {
    name: string;
    /** Report text. For photos and scans this comes from Document AI. */
    excerpt: string;
  };
}

/** Builds the message list for one composer submission. */
export function buildCoachMessages({
  question,
  report,
}: CoachTurnInput): SarvamChatMessage[] {
  const asked =
    question.trim() ||
    "Explain this report to me in plain language and tell me what stands out.";

  if (!report) {
    return [
      { role: "system", content: HEALTH_COACH_SYSTEM_PROMPT },
      { role: "user", content: asked },
    ];
  }

  const context = report.excerpt.trim()
    ? `Report "${report.name}" contents:\n"""\n${report.excerpt.trim()}\n"""`
    : `A report named "${report.name}" was attached but no text could be read from it. Say so, and ask for a clearer copy.`;

  return [
    { role: "system", content: HEALTH_COACH_SYSTEM_PROMPT },
    { role: "user", content: `${context}\n\n${asked}` },
  ];
}


/* -------------------------------------------------------------------------- */
/* Document AI                                                                */
/* -------------------------------------------------------------------------- */

const DOC_AI_ROOT = "/doc-digitization/job/v1";
const DOC_AI_TIMEOUT_MS = 30_000;

async function docAi<T>(
  path: string,
  init: { method: "GET" | "POST"; body?: unknown } = { method: "GET" },
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${DOC_AI_ROOT}${path}`, {
      method: init.method,
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: init.method === "POST" ? JSON.stringify(init.body ?? {}) : undefined,
      signal: AbortSignal.timeout(DOC_AI_TIMEOUT_MS),
    });
  } catch (cause) {
    asNetworkError(cause);
  }

  if (!response.ok) await failFromResponse(response);
  return (await response.json()) as T;
}

/** Creates a digitisation job. Nothing is processed until `startDocAiJob`. */
export function createDocAiJob(
  parameters: Partial<DocAiJobParameters> = {},
): Promise<DocAiJob> {
  return docAi<DocAiJob>("", {
    method: "POST",
    body: {
      job_parameters: {
        language: parameters.language ?? "en-IN",
        output_format: parameters.output_format ?? "md",
      },
    },
  });
}

/** Presigned upload targets, keyed by the filenames you asked for. */
export function getDocAiUploadUrls(
  jobId: string,
  filenames: string[],
): Promise<DocAiFileLinks> {
  return docAi<DocAiFileLinks>("/upload-files", {
    method: "POST",
    body: { job_id: jobId, files: filenames },
  });
}

/** Blob storage wants the block-blob header; it is not a Sarvam endpoint. */
export async function putToUploadUrl(url: string, body: ArrayBuffer): Promise<void> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "PUT",
      headers: { "x-ms-blob-type": "BlockBlob" },
      body,
      signal: AbortSignal.timeout(60_000),
    });
  } catch (cause) {
    asNetworkError(cause);
  }
  if (!response.ok) {
    throw new SarvamError("upstream_error", "The document could not be staged for reading.");
  }
}

export function startDocAiJob(jobId: string): Promise<DocAiJob> {
  return docAi<DocAiJob>(`/${jobId}/start`, { method: "POST" });
}

export function getDocAiJobStatus(jobId: string): Promise<DocAiJob> {
  return docAi<DocAiJob>(`/${jobId}/status`);
}

export function getDocAiDownloadUrls(jobId: string): Promise<DocAiFileLinks> {
  return docAi<DocAiFileLinks>(`/${jobId}/download-files`, { method: "POST" });
}

/** Fetches the result archive Sarvam produced for a finished job. */
export async function fetchDocAiArchive(url: string): Promise<Uint8Array> {
  let response: Response;
  try {
    response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  } catch (cause) {
    asNetworkError(cause);
  }
  if (!response.ok) {
    throw new SarvamError("upstream_error", "The extracted document could not be downloaded.");
  }
  return new Uint8Array(await response.arrayBuffer());
}

/* -------------------------------------------------------------------------- */
/* Translation                                                                */
/* -------------------------------------------------------------------------- */

/** Hard cap for `sarvam-translate:v1`. Callers must chunk below this. */
export const TRANSLATE_MAX_CHARS = 2000;

export async function translate(
  request: SarvamTranslateRequest,
): Promise<SarvamTranslateResponse> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/translate`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({
        model: request.model ?? "sarvam-translate:v1",
        input: request.input,
        source_language_code: request.source_language_code,
        target_language_code: request.target_language_code,
        mode: request.mode ?? "formal",
        numerals_format: request.numerals_format ?? "international",
      }),
      signal: AbortSignal.timeout(30_000),
    });
  } catch (cause) {
    asNetworkError(cause);
  }

  if (!response.ok) await failFromResponse(response);

  const data = (await response.json()) as Partial<SarvamTranslateResponse>;
  return {
    request_id: data.request_id ?? null,
    translated_text: data.translated_text ?? "",
    source_language_code: data.source_language_code ?? null,
  };
}
