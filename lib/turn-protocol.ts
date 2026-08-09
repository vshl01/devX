import type { TurnConfidence, TurnMeta } from "@/types/conversation";

/**
 * The wire format between `/api/converse` and the browser, kept client-safe so
 * both sides parse a reply the same way. The server owns the prompt that
 * produces it (`lib/conversation.ts`).
 */

export const META_SENTINEL_CLIENT = "%%META%%";

const VALUES: TurnConfidence[] = ["grounded", "unclear_source", "outside_document"];

export function parseClientTurn(raw: string): { text: string; meta: TurnMeta } {
  const at = raw.indexOf(META_SENTINEL_CLIENT);
  if (at === -1) return { text: raw.trim(), meta: { confidence: "grounded", refs: [] } };

  const text = raw.slice(0, at).trim();

  try {
    const parsed = JSON.parse(raw.slice(at + META_SENTINEL_CLIENT.length).trim()) as
      Partial<TurnMeta>;
    return {
      text,
      meta: {
        confidence: VALUES.includes(parsed.confidence as TurnConfidence)
          ? (parsed.confidence as TurnConfidence)
          : "grounded",
        refs: Array.isArray(parsed.refs)
          ? parsed.refs.filter((ref): ref is string => typeof ref === "string").slice(0, 6)
          : [],
      },
    };
  } catch {
    return { text, meta: { confidence: "grounded", refs: [] } };
  }
}
