import { fail } from "@/lib/http";
import { buildCoachMessages, streamChat } from "@/lib/sarvam";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 4_000;
const MAX_EXCERPT_CHARS = 12_000;

interface ChatRequestBody {
  question?: string;
  report?: { name?: string; excerpt?: string };
}

/**
 * Answers one composer submission. Streams plain text so the hero can render
 * the reply as it arrives. Report text arrives already extracted, by `unpdf`
 * for text-layer PDFs and by Document AI for scans and photographs.
 */
export async function POST(request: Request) {
  let body: ChatRequestBody;
  try {
    body = (await request.json()) as ChatRequestBody;
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const question = (body.question ?? "").slice(0, MAX_QUESTION_CHARS).trim();
  const name = body.report?.name;

  if (!question && !name) {
    return fail("Ask a question or attach a report.", 400);
  }

  const messages = buildCoachMessages({
    question,
    report: name
      ? { name, excerpt: (body.report?.excerpt ?? "").slice(0, MAX_EXCERPT_CHARS) }
      : undefined,
  });

  try {
    const stream = await streamChat({ messages });
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
    default:
      return "The coach could not answer just now.";
  }
}
