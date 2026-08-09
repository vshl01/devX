import { fail, json } from "@/lib/http";
import { transcribe } from "@/lib/sarvam";
import type { TranscribeResponse } from "@/types/composer";
import { SarvamError, type SarvamLanguageCode } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 30 seconds of 16 kHz mono PCM plus the WAV header. */
const MAX_SEGMENT_BYTES = 16_000 * 2 * 30 + 44;

/**
 * Fallback transcription path for hosts without the WebSocket relay in
 * `server.mjs`. Takes one finished utterance as a WAV file and returns its
 * transcript. The realtime path is `/api/stt/ws`.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Expected an audio segment.", 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) {
    return fail("Expected an audio segment.", 400);
  }
  if (audio.size > MAX_SEGMENT_BYTES) {
    return fail("That audio segment is too long.", 413);
  }

  const languageCode = (form.get("languageCode") as SarvamLanguageCode | null) ?? "unknown";

  try {
    const result = await transcribe({ audio, languageCode });
    return json<TranscribeResponse>({
      transcript: result.transcript,
      languageCode: result.language_code,
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(messageFor(cause), cause.status, cause.code);
    }
    return fail("Transcription failed.", 500);
  }
}

function messageFor(error: SarvamError): string {
  switch (error.code) {
    case "missing_key":
      return "Speech to text is not configured on this deployment.";
    case "rate_limited":
      return "Too many requests right now. Try again in a moment.";
    case "network_error":
      return "Lost connection while transcribing.";
    default:
      return "Transcription failed.";
  }
}
