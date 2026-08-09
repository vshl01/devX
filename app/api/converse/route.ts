import {
  buildConversationMessages,
  HISTORY_LIMIT,
  META_SENTINEL,
  parseTurn,
} from "@/lib/conversation";
import { fail } from "@/lib/http";
import {
  isTranslatableLanguage,
  languageLabel,
  type TranslatableLanguage,
} from "@/lib/languages";
import { streamChat } from "@/lib/sarvam";
import { loadContext, loadHistory, saveMessage } from "@/lib/sessions";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUESTION_CHARS = 2_000;

interface ConverseBody {
  sessionId?: string;
  /** Client-minted so audio can be attached before the turn finishes. */
  messageId?: string;
  userMessageId?: string;
  /** Absent for the opening turn the agent starts by itself. */
  text?: string;
  language?: string;
}

/**
 * One conversational turn. Streams the spoken text so the client can start
 * synthesising before the model has finished, and persists both sides of the
 * turn once the stream closes.
 */
export async function POST(request: Request) {
  let body: ConverseBody;
  try {
    body = (await request.json()) as ConverseBody;
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const sessionId = body.sessionId?.trim();
  const messageId = body.messageId?.trim();
  if (!sessionId || !messageId) {
    return fail("Missing session or message id.", 400);
  }

  const requested = body.language ?? "";
  const language: TranslatableLanguage = isTranslatableLanguage(requested) ? requested : "en-IN";
  const question = (body.text ?? "").slice(0, MAX_QUESTION_CHARS).trim();

  const context = await loadContext(sessionId);
  if (!context) {
    return fail("Upload a document before starting the conversation.", 409);
  }

  // The user's turn is durable before the model is asked anything, so a failed
  // reply never loses what the person said.
  if (question && body.userMessageId) {
    await saveMessage({
      id: body.userMessageId,
      sessionId,
      role: "user",
      text: question,
      language,
    });
  }

  const history = await loadHistory(sessionId, HISTORY_LIMIT);

  try {
    const upstream = await streamChat({
      messages: buildConversationMessages({
        documentMarkdown: context.markdown,
        report: context.report,
        history: question ? history.slice(0, -1) : history,
        language: languageLabel(language),
        question,
      }),
      temperature: 0.3,
      max_tokens: 500,
    });

    let raw = "";

    const persisted = new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        raw += new TextDecoder().decode(chunk, { stream: true });
        controller.enqueue(chunk);
      },
      async flush() {
        const { text, meta } = parseTurn(raw);
        if (!text) return;
        await saveMessage({
          id: messageId,
          sessionId,
          role: "assistant",
          text,
          language,
          meta,
        }).catch(() => null);
      },
    });

    return new Response(upstream.pipeThrough(persisted), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
        "X-Meta-Sentinel": META_SENTINEL,
      },
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(
        cause.code === "missing_key"
          ? "The assistant is not configured on this deployment."
          : cause.code === "rate_limited"
            ? "Too many requests right now. Try again in a moment."
            : "The assistant could not answer just now.",
        cause.status,
        cause.code,
      );
    }
    return fail("The assistant could not answer just now.", 500);
  }
}
