import "server-only";

import type { TranslatableLanguage } from "@/lib/languages";
import { TRANSLATE_MAX_CHARS, translate } from "@/lib/sarvam";
import type { SarvamLanguageCode } from "@/types/sarvam";

/**
 * Structure-preserving Markdown translation.
 *
 * Sarvam's translate endpoint takes plain text, so sending a whole document
 * would come back with the headings, pipes and bullets rewritten or dropped.
 * Instead the document is split into the smallest translatable units, the
 * Markdown scaffolding is held back on this side, and only the prose is sent.
 */


/** Six at a time keeps a long report under a few seconds without tripping limits. */
const CONCURRENCY = 6;

/** Nothing here carries meaning a translator can improve: numbers, units, symbols. */
const NOT_PROSE = /^[\s\d.,:;/\\|%+()[\]<>=~^*_-]*$/;

/** Leading Markdown scaffolding: heading marks, bullets, quotes, indentation. */
const BLOCK_PREFIX = /^(\s*(?:>\s*)*(?:[-*+]\s+|\d+[.)]\s+|#{1,6}\s+)?)([\s\S]*)$/;

/** A cell or line that is entirely bold or italic keeps its wrapper. */
const WHOLLY_EMPHASISED = /^(\*\*\*|\*\*|\*|__|_)([\s\S]+?)\1$/;

const TABLE_DIVIDER = /^\s*\|?[\s:|-]+\|[\s:|-]*$/;

/** A control character cannot occur in Markdown, so placeholders never collide. */
const SENTINEL = String.fromCharCode(0);
const PLACEHOLDER = new RegExp(`${SENTINEL}(\\d+)${SENTINEL}`, "g");

interface Unit {
  text: string;
  /** Rebuilds the original scaffolding around the translated text. */
  restore: (translated: string) => string;
}

function shouldTranslate(text: string): boolean {
  return text.trim().length > 0 && !NOT_PROSE.test(text);
}

/** Peels emphasis markers off so they cannot be mangled in transit. */
function peelEmphasis(text: string): { core: string; wrap: (value: string) => string } {
  const match = WHOLLY_EMPHASISED.exec(text.trim());
  if (!match) return { core: text, wrap: (value) => value };

  const [, marker, inner] = match;
  const leading = text.slice(0, text.length - text.trimStart().length);
  const trailing = text.slice(text.trimEnd().length);
  return {
    core: inner,
    wrap: (value) => `${leading}${marker}${value}${marker}${trailing}`,
  };
}

function pushUnit(units: Unit[], raw: string, restore: (translated: string) => string): string {
  const { core, wrap } = peelEmphasis(raw);

  if (!shouldTranslate(core)) return restore(raw);

  const token = `${SENTINEL}${units.length}${SENTINEL}`;
  units.push({ text: core.trim(), restore: (translated) => wrap(translated) });
  return restore(token);
}

/**
 * Splits a document into translatable units and a template. The template is the
 * original text with each unit replaced by a placeholder, so reassembly is a
 * plain substitution and the structure cannot drift.
 */
function planDocument(markdown: string): { template: string; units: Unit[] } {
  const units: Unit[] = [];
  const lines = markdown.split("\n");
  const output: string[] = [];
  let inFence = false;

  for (const line of lines) {
    if (/^\s*(```|~~~)/.test(line)) {
      inFence = !inFence;
      output.push(line);
      continue;
    }
    if (inFence || line.trim() === "" || TABLE_DIVIDER.test(line)) {
      output.push(line);
      continue;
    }

    // Table row: translate each cell, keep every pipe exactly where it was.
    if (line.trim().startsWith("|")) {
      const parts = line.split("|");
      const rebuilt = parts.map((cell, index) => {
        if (index === 0 || index === parts.length - 1) return cell;
        const lead = cell.slice(0, cell.length - cell.trimStart().length);
        const tail = cell.slice(cell.trimEnd().length);
        const body = cell.trim();
        if (!shouldTranslate(body)) return cell;
        return pushUnit(units, body, (token) => `${lead}${token}${tail}`);
      });
      output.push(rebuilt.join("|"));
      continue;
    }

    const [, prefix, body] = BLOCK_PREFIX.exec(line) ?? [, "", line];
    output.push(pushUnit(units, body ?? "", (token) => `${prefix ?? ""}${token}`));
  }

  return { template: output.join("\n"), units };
}

async function mapWithLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export interface TranslateMarkdownInput {
  markdown: string;
  target: TranslatableLanguage;
  source?: SarvamLanguageCode | "auto";
}

/** Translates the prose in a Markdown document, leaving the structure intact. */
export async function translateMarkdown({
  markdown,
  target,
  source = "auto",
}: TranslateMarkdownInput): Promise<string> {
  const { template, units } = planDocument(markdown);
  if (units.length === 0) return markdown;

  // Repeated cells such as "Normal" are translated once and reused.
  const memo = new Map<string, Promise<string>>();

  const translated = await mapWithLimit(units, CONCURRENCY, async (unit) => {
    // A single unit longer than the model limit is split on sentence bounds.
    if (unit.text.length > TRANSLATE_MAX_CHARS) {
      const pieces = splitLongText(unit.text);
      const parts = await mapWithLimit(pieces, 2, (piece) => translateOnce(piece, target, source, memo));
      return unit.restore(parts.join(" "));
    }
    return unit.restore(await translateOnce(unit.text, target, source, memo));
  });

  return template.replace(PLACEHOLDER, (_, index: string) => translated[Number(index)]);
}

function translateOnce(
  text: string,
  target: TranslatableLanguage,
  source: SarvamLanguageCode | "auto",
  memo: Map<string, Promise<string>>,
): Promise<string> {
  const cached = memo.get(text);
  if (cached) return cached;

  const pending = translate({
    input: text,
    source_language_code: source,
    target_language_code: target,
  })
    .then((result) => result.translated_text.trim() || text)
    // A single failed unit degrades to the original wording rather than
    // collapsing the whole document.
    .catch(() => text);

  memo.set(text, pending);
  return pending;
}

function splitLongText(text: string): string[] {
  const sentences = text.match(/[^.!?]+[.!?]*\s*/g) ?? [text];
  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    if ((current + sentence).length > TRANSLATE_MAX_CHARS && current) {
      chunks.push(current.trim());
      current = "";
    }
    current += sentence;
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}
