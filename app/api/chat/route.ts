import { fail } from "@/lib/http";
import { buildCoachMessages, buildTextOnlyFallback, streamChat } from "@/lib/sarvam";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 4_000;
const MAX_EXCERPT_CHARS = 12_000;
/** Base64 grows by a third, so this caps an image at roughly 6 MB on the wire. */
const MAX_IMAGE_CHARS = 8_000_000;

interface ChatRequestBody {
  question?: string;
  report?: {
    name?: string;
    excerpt?: string;
    imageDataUrl?: string;
  };
}

/**
 * Answers one composer submission. Streams plain text so the hero can render
 * the reply as it arrives.
 */
export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const question = (body.question ?? "").slice(0, MAX_QUESTION_CHARS).trim();
  const hasReport = Boolean(body.report?.name);

  if (!question && !hasReport) {
    return fail("Ask a question or attach a report.", 400);
  }

  const imageDataUrl = body.report?.imageDataUrl;
  if (imageDataUrl) {
    if (imageDataUrl.length > MAX_IMAGE_CHARS) {
      return fail("That image is too large to read. Try a smaller photo.", 413);
    }
    if (!/^data:image\/(png|jpeg|jpg|webp|heic|heif);base64,/.test(imageDataUrl)) {
      return fail("That image format is not supported.", 415);
    }
  }

  const turn = {
    question,
    report: hasReport
      ? {
          name: body.report!.name!,
          excerpt: (body.report!.excerpt ?? "").slice(0, MAX_EXCERPT_CHARS),
          imageDataUrl,
        }
      : undefined,
  };

  try {
    let stream: ReadableStream<Uint8Array>;
    try {
      stream = await streamChat({ messages: buildCoachMessages(turn) });
    } catch (cause) {
      // Some models reject image parts. Retry once on text alone rather than
      // showing the user a dead end.
      if (imageDataUrl && cause instanceof SarvamError && cause.code === "unsupported_input") {
        stream = await streamChat({ messages: buildTextOnlyFallback(turn) });
      } else {
        throw cause;
      }
    }

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(messageFor(cause), cause.status, cause.code);
    }
    return fail("The coach could not answer just now.", 500);
  }
}

function messageFor(error: SarvamError): string {
  switch (error.code) {
    case "missing_key":
      return "The assistant is not configured on this deployment.";
    case "rate_limited":
      return "Too many requests right now. Try again in a moment.";
    case "network_error":
      return "Lost connection to the assistant.";
    case "unsupported_input":
      return "That report could not be read. Try a PDF or a clearer photo.";
    default:
      return "The coach could not answer just now.";
  }
}
