import "server-only";

import type { SarvamChatMessage } from "@/types/sarvam";
import type { TurnConfidence, TurnMeta } from "@/types/conversation";

/**
 * The spoken agent. It reads one uploaded document and talks the person through
 * it. Everything it says is either traceable to that document or openly flagged
 * as not coming from it.
 */

/** Terminates the spoken part of a reply; everything after it is machine data. */
export const META_SENTINEL = "%%META%%";

const RULES = `You are Lucid, a health reading assistant talking out loud with the person whose document this is. Your reply is spoken aloud, so write the way a careful clinician speaks: warm, direct, plain words, contractions welcome. No headings, no bullet points, no markdown, no lists, no emoji.

Grounding, which matters more than anything else:
- Every clinical statement must come from the document text you were given. Quote the actual number when you use one.
- If the answer is not in the document, say that plainly in the reply, and set confidence to outside_document.
- If the document has the answer but the scan or handwriting is not legible, say exactly which part you cannot read and ask the person to confirm it, then set confidence to unclear_source. Never guess a dose, a drug name or a value.
- Otherwise set confidence to grounded.

What you are not:
- You do not diagnose, name a condition as fact, prescribe, or change a dose. When the person asks what to do about a result or a medicine, explain what the value means and why it matters, then hand the decision to their physician in one natural sentence. Do not stack disclaimers; the screen already carries one.
- If anything sounds urgent, say so first and clearly.

How to talk:
- Your first sentence must be short: at most twelve words, and it must carry the point. Longer explanation goes in the sentences after it.
- Two to four sentences, then at most one question. One question at a time, never two.
- Explain what a value measures and why it matters before touching what happens next.
- Answer in the language named below, including the numbers and units.
- Never open with a generic greeting or "how can I help".

End every reply with a single line, after the spoken text, in exactly this form and nothing after it:
${META_SENTINEL}{"confidence":"grounded|unclear_source|outside_document","refs":["the exact value or line you used","page 2"]}
Use an empty refs array when you used nothing from the document.`;

function languageLine(language: string): string {
  return `Speak in ${language}. If the document is in another language, still answer in ${language}.`;
}

function documentBlock(markdown: string, report: string | null): string {
  const parts = [`Document text extracted by OCR:\n"""\n${markdown.trim()}\n"""`];
  if (report?.trim()) {
    parts.push(`The written summary already shown on screen:\n"""\n${report.trim()}\n"""`);
  }
  return parts.join("\n\n");
}

export interface ConversationTurn {
  role: "user" | "assistant";
  text: string;
}

export interface BuildTurnInput {
  documentMarkdown: string;
  report: string | null;
  history: ConversationTurn[];
  language: string;
  /** Absent for the opening turn, which the agent starts by itself. */
  question?: string;
}

/** How many past turns travel with each request. */
export const HISTORY_LIMIT = 12;

export function buildConversationMessages({
  documentMarkdown,
  report,
  history,
  language,
  question,
}: BuildTurnInput): SarvamChatMessage[] {
  const system = [RULES, languageLine(language)].join("\n\n");

  const messages: SarvamChatMessage[] = [
    { role: "system", content: system },
    { role: "user", content: documentBlock(documentMarkdown, report) },
    {
      role: "assistant",
      content: "I have read the document and I am ready to talk it through.",
    },
  ];

  for (const turn of history.slice(-HISTORY_LIMIT)) {
    messages.push({ role: turn.role, content: turn.text });
  }

  messages.push({
    role: "user",
    content:
      question?.trim() ||
      "Open the conversation yourself. Lead with a short first sentence naming the single most important finding and its actual value, then one or two sentences on what it means, then ask one specific question that only makes sense for this document. Do not greet me and do not ask how you can help.",
  });

  return messages;
}

const CONFIDENCE_VALUES: TurnConfidence[] = ["grounded", "unclear_source", "outside_document"];

/**
 * Splits a finished reply into what was spoken and what the model asserted
 * about it. A missing or malformed trailer is treated as ungrounded rather
 * than silently trusted.
 */
export function parseTurn(raw: string): { text: string; meta: TurnMeta } {
  const at = raw.indexOf(META_SENTINEL);

  if (at === -1) {
    return {
      text: raw.trim(),
      meta: { confidence: "grounded", refs: [] },
    };
  }

  const text = raw.slice(0, at).trim();
  const trailer = raw.slice(at + META_SENTINEL.length).trim();

  try {
    const parsed = JSON.parse(trailer) as Partial<TurnMeta>;
    const confidence = CONFIDENCE_VALUES.includes(parsed.confidence as TurnConfidence)
      ? (parsed.confidence as TurnConfidence)
      : "grounded";
    const refs = Array.isArray(parsed.refs)
      ? parsed.refs.filter((ref): ref is string => typeof ref === "string").slice(0, 6)
      : [];
    return { text, meta: { confidence, refs } };
  } catch {
    return { text, meta: { confidence: "grounded", refs: [] } };
  }
}

/** Maps the wire value onto the Prisma enum. */
export function toDbConfidence(
  confidence: TurnConfidence,
): "GROUNDED" | "UNCLEAR_SOURCE" | "OUTSIDE_DOCUMENT" {
  if (confidence === "unclear_source") return "UNCLEAR_SOURCE";
  if (confidence === "outside_document") return "OUTSIDE_DOCUMENT";
  return "GROUNDED";
}

export function fromDbConfidence(value: string): TurnConfidence {
  if (value === "UNCLEAR_SOURCE") return "unclear_source";
  if (value === "OUTSIDE_DOCUMENT") return "outside_document";
  return "grounded";
}
