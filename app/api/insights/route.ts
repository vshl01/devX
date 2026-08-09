import { fail } from "@/lib/http";
import { buildReportMessages, MAX_DOCUMENT_CHARS } from "@/lib/insights";
import { streamChat } from "@/lib/sarvam";
import { saveReport } from "@/lib/sessions";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Streams the structured Markdown report for one extracted document. */
export async function POST(request: Request) {
  let body: { text?: string; sessionId?: string };
  try {
    body = (await request.json()) as { text?: string; sessionId?: string };
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const text = (body.text ?? "").slice(0, MAX_DOCUMENT_CHARS).trim();
  if (text.length < 12) {
    return fail("There was not enough text in that document to read.", 400);
  }

  try {
    const upstream = await streamChat({
      messages: buildReportMessages(text),
      temperature: 0.2,
      max_tokens: 1800,
    });

    const sessionId = body.sessionId?.trim();
    let report = "";

    // The report is stored as it finishes, so a reload restores the pane.
    const stream = upstream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          report += new TextDecoder().decode(chunk, { stream: true });
          controller.enqueue(chunk);
        },
        async flush() {
          if (sessionId && report.trim()) {
            await saveReport(sessionId, report).catch(() => null);
          }
        },
      }),
    );

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(
        cause.code === "missing_key"
          ? "The report reader is not configured on this deployment."
          : "The report could not be written just now.",
        cause.status,
        cause.code,
      );
    }
    return fail("The report could not be written just now.", 500);
  }
}
