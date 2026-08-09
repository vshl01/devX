import { fail } from "@/lib/http";
import { canSpeak, synthesize, TTS_MAX_CHARS } from "@/lib/sarvam";
import { saveMessageAudio } from "@/lib/sessions";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TtsBody {
  text?: string;
  language?: string;
  /** Present when this chunk belongs to a stored turn, so replay works later. */
  messageId?: string;
  index?: number;
}

/**
 * Synthesises one chunk of a spoken turn and returns the audio directly, so the
 * browser can play it without a second round trip. The bytes are also stored
 * against the message for replay after a reload.
 */
export async function POST(request: Request) {
  let body: TtsBody;
  try {
    body = (await request.json()) as TtsBody;
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const text = (body.text ?? "").slice(0, TTS_MAX_CHARS).trim();
  const language = body.language ?? "en-IN";

  if (!text) return fail("Nothing to speak.", 400);
  if (!canSpeak(language)) return fail("That language has no voice yet.", 415);

  try {
    const { audio, mimeType } = await synthesize({ text, languageCode: language });

    if (body.messageId && Number.isInteger(body.index)) {
      // Storage must never delay playback.
      void saveMessageAudio(body.messageId, body.index as number, audio, mimeType).catch(
        () => null,
      );
    }

    return new Response(new Uint8Array(audio), {
      headers: {
        "Content-Type": mimeType,
        "Content-Length": String(audio.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(
        cause.code === "rate_limited"
          ? "The voice is busy right now."
          : "The reply could not be spoken.",
        cause.status,
        cause.code,
      );
    }
    return fail("The reply could not be spoken.", 500);
  }
}
