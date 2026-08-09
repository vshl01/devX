import { fail, json } from "@/lib/http";
import { isTranslatableLanguage } from "@/lib/languages";
import { translateMarkdown } from "@/lib/markdown-translate";
import { readTranslation, writeTranslation } from "@/lib/sessions";
import { SarvamError } from "@/types/sarvam";
import type { TranslateResponse } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_MARKDOWN_CHARS = 30_000;

/** Translates a Markdown report while leaving its structure untouched. */
export async function POST(request: Request) {
  let body: { markdown?: string; target?: string; source?: string; sessionId?: string };
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return fail("Expected a JSON body.", 400);
  }

  const markdown = (body.markdown ?? "").slice(0, MAX_MARKDOWN_CHARS);
  const target = body.target ?? "";

  if (!markdown.trim()) return fail("Nothing to translate.", 400);
  if (!isTranslatableLanguage(target)) return fail("Unsupported language.", 400);

  const sessionId = body.sessionId?.trim();

  if (sessionId) {
    const cached = await readTranslation(sessionId, target).catch(() => null);
    if (cached) return json<TranslateResponse>({ language: target, markdown: cached });
  }

  try {
    const translated = await translateMarkdown({
      markdown,
      target,
      source: body.source === "auto" || !body.source ? "auto" : "en-IN",
    });
    if (sessionId) await writeTranslation(sessionId, target, translated);
    return json<TranslateResponse>({ language: target, markdown: translated });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(
        cause.code === "rate_limited"
          ? "Translation is busy right now. Try again in a moment."
          : "The translation failed.",
        cause.status,
        cause.code,
      );
    }
    return fail("The translation failed.", 500);
  }
}
