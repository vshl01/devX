import "server-only";

import { db } from "@/lib/db";
import { fromDbConfidence, toDbConfidence } from "@/lib/conversation";
import type { ChatMessage, SessionSnapshot, TurnMeta } from "@/types/conversation";
import type { DocumentKind } from "@/types/workspace";

/** Everything the workspace persists. One session holds one document. */

/** Documents larger than this are read but not kept for preview. */
const MAX_STORED_BYTES = 12 * 1024 * 1024;

export async function createSession(language: string): Promise<string> {
  const session = await db.session.create({ data: { language } });
  return session.id;
}

/** Returns the session, creating it if the browser sent an id we have not seen. */
export async function ensureSession(sessionId: string, language: string): Promise<string> {
  const existing = await db.session.findUnique({ where: { id: sessionId }, select: { id: true } });
  if (existing) return existing.id;

  const created = await db.session.create({ data: { id: sessionId, language } });
  return created.id;
}

export async function setSessionLanguage(sessionId: string, language: string): Promise<void> {
  await db.session.update({ where: { id: sessionId }, data: { language } }).catch(() => null);
}

/** Prisma wants a Uint8Array backed by a plain ArrayBuffer. */
function toBytes(view: Uint8Array): Uint8Array<ArrayBuffer> {
  return new Uint8Array(
    view.buffer.slice(view.byteOffset, view.byteOffset + view.byteLength) as ArrayBuffer,
  );
}

export interface RecordDocumentInput {
  sessionId: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  kind: DocumentKind;
  sarvamJobId: string;
  bytes: Uint8Array;
}

/**
 * A session holds the document currently being discussed, so uploading a new
 * one clears the previous document and the conversation about it.
 */
export async function recordDocument(input: RecordDocumentInput): Promise<string> {
  await db.$transaction([
    db.document.deleteMany({ where: { sessionId: input.sessionId } }),
    db.message.deleteMany({ where: { sessionId: input.sessionId } }),
    db.reportTranslation.deleteMany({ where: { sessionId: input.sessionId } }),
  ]);

  const document = await db.document.create({
    data: {
      sessionId: input.sessionId,
      fileName: input.fileName,
      mimeType: input.mimeType,
      sizeBytes: input.sizeBytes,
      kind: input.kind,
      sarvamJobId: input.sarvamJobId,
      // Skipped past this size: the preview is not worth the row.
      bytes: input.bytes.byteLength <= MAX_STORED_BYTES ? toBytes(input.bytes) : null,
    },
  });

  return document.id;
}

export async function saveExtraction(
  sarvamJobId: string,
  markdown: string,
  pageCount: number,
): Promise<void> {
  const document = await db.document.findFirst({
    where: { sarvamJobId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!document) return;

  await db.extraction.upsert({
    where: { documentId: document.id },
    create: { documentId: document.id, markdown, pageCount },
    update: { markdown, pageCount },
  });
}

export async function saveReport(sessionId: string, report: string): Promise<void> {
  const document = await db.document.findFirst({
    where: { sessionId },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });
  if (!document) return;

  await db.extraction
    .update({ where: { documentId: document.id }, data: { report } })
    .catch(() => null);
}

/** The document context the agent reasons over. */
export async function loadContext(
  sessionId: string,
): Promise<{ markdown: string; report: string | null; language: string } | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      language: true,
      documents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { extraction: { select: { markdown: true, report: true } } },
      },
    },
  });

  const extraction = session?.documents[0]?.extraction;
  if (!session || !extraction) return null;

  return {
    markdown: extraction.markdown,
    report: extraction.report,
    language: session.language,
  };
}

export async function loadHistory(
  sessionId: string,
  limit: number,
): Promise<Array<{ role: "user" | "assistant"; text: string }>> {
  const rows = await db.message.findMany({
    where: { sessionId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: { role: true, text: true },
  });

  return rows
    .reverse()
    .map((row) => ({ role: row.role === "USER" ? ("user" as const) : ("assistant" as const), text: row.text }));
}

export interface SaveMessageInput {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  text: string;
  language: string;
  meta?: TurnMeta;
  audioUrl?: string | null;
}

export async function saveMessage(input: SaveMessageInput): Promise<void> {
  const confidence = toDbConfidence(input.meta?.confidence ?? "grounded");

  await db.message.upsert({
    where: { id: input.id },
    create: {
      id: input.id,
      sessionId: input.sessionId,
      role: input.role === "user" ? "USER" : "ASSISTANT",
      text: input.text,
      language: input.language,
      confidence,
      sourceRefs: input.meta?.refs ?? [],
      audioUrl: input.audioUrl ?? null,
    },
    update: {
      text: input.text,
      confidence,
      sourceRefs: input.meta?.refs ?? [],
      audioUrl: input.audioUrl ?? undefined,
    },
  });
}

export async function saveMessageAudio(
  messageId: string,
  index: number,
  bytes: Buffer,
  mimeType: string,
): Promise<void> {
  const data = toBytes(bytes);

  await db.messageAudio.upsert({
    where: { messageId_index: { messageId, index } },
    create: { messageId, index, bytes: data, mimeType },
    update: { bytes: data, mimeType },
  });

  await db.message
    .update({ where: { id: messageId }, data: { audioUrl: `/api/audio/${messageId}` } })
    .catch(() => null);
}

export async function loadMessageAudio(
  messageId: string,
): Promise<{ bytes: Buffer; mimeType: string } | null> {
  const clips = await db.messageAudio.findMany({
    where: { messageId },
    orderBy: { index: "asc" },
    select: { bytes: true, mimeType: true },
  });
  if (clips.length === 0) return null;

  // MP3 frames concatenate cleanly, so the whole turn replays as one file.
  return {
    bytes: Buffer.concat(clips.map((clip) => Buffer.from(clip.bytes))),
    mimeType: clips[0].mimeType,
  };
}

export async function readTranslation(
  sessionId: string,
  language: string,
): Promise<string | null> {
  const row = await db.reportTranslation.findUnique({
    where: { sessionId_language: { sessionId, language } },
    select: { markdown: true },
  });
  return row?.markdown ?? null;
}

export async function writeTranslation(
  sessionId: string,
  language: string,
  markdown: string,
): Promise<void> {
  await db.reportTranslation
    .upsert({
      where: { sessionId_language: { sessionId, language } },
      create: { sessionId, language, markdown },
      update: { markdown },
    })
    .catch(() => null);
}

function toChatMessage(row: {
  id: string;
  role: string;
  text: string;
  language: string;
  confidence: string;
  sourceRefs: unknown;
  audioUrl: string | null;
  createdAt: Date;
}): ChatMessage {
  return {
    id: row.id,
    role: row.role === "USER" ? "user" : "assistant",
    text: row.text,
    language: row.language,
    confidence: fromDbConfidence(row.confidence),
    refs: Array.isArray(row.sourceRefs) ? (row.sourceRefs as string[]) : [],
    audioUrl: row.audioUrl,
    createdAt: row.createdAt.toISOString(),
  };
}

/** Everything needed to put the workspace back exactly as it was. */
export async function loadSnapshot(sessionId: string): Promise<SessionSnapshot | null> {
  const session = await db.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      language: true,
      documents: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          id: true,
          fileName: true,
          mimeType: true,
          sizeBytes: true,
          kind: true,
          extraction: { select: { markdown: true, pageCount: true, report: true } },
        },
      },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          role: true,
          text: true,
          language: true,
          confidence: true,
          sourceRefs: true,
          audioUrl: true,
          createdAt: true,
        },
      },
    },
  });

  if (!session) return null;

  const document = session.documents[0] ?? null;

  return {
    sessionId: session.id,
    language: session.language,
    document: document
      ? {
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          sizeBytes: document.sizeBytes,
          kind: document.kind === "image" ? "image" : "pdf",
        }
      : null,
    extraction: document?.extraction
      ? {
          markdown: document.extraction.markdown,
          pageCount: document.extraction.pageCount,
          report: document.extraction.report,
        }
      : null,
    messages: session.messages.map(toChatMessage),
  };
}

export async function loadDocumentFile(
  documentId: string,
): Promise<{ bytes: Buffer; mimeType: string; fileName: string } | null> {
  const row = await db.document.findUnique({
    where: { id: documentId },
    select: { bytes: true, mimeType: true, fileName: true },
  });
  if (!row?.bytes) return null;

  return {
    bytes: Buffer.from(row.bytes),
    mimeType: row.mimeType,
    fileName: row.fileName,
  };
}
