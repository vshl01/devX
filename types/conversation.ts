/** Contracts for the voice conversation layer. */

export type TurnConfidence = "grounded" | "unclear_source" | "outside_document";

export interface TurnMeta {
  confidence: TurnConfidence;
  /** Extracted values or pages the claim came from. */
  refs: string[];
}

export type ChatRole = "user" | "assistant";

export interface ChatMessage {
  id: string;
  role: ChatRole;
  text: string;
  language: string;
  confidence: TurnConfidence;
  refs: string[];
  /** Replay route, present once the turn has spoken audio stored. */
  audioUrl: string | null;
  createdAt: string;
  /** True while the text is still being transcribed or generated. */
  pending?: boolean;
}

/** What the voice control bar shows, and what the machine allows next. */
export type VoiceStatus =
  | "idle"
  | "listening"
  | "thinking"
  | "speaking"
  | "denied"
  | "unsupported"
  | "error";

export interface SessionSnapshot {
  sessionId: string;
  language: string;
  document: {
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
    kind: "pdf" | "image";
  } | null;
  extraction: { markdown: string; pageCount: number; report: string | null } | null;
  messages: ChatMessage[];
}
