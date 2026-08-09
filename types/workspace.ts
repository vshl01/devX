import type { TranslatableLanguage } from "@/lib/languages";

/** Contracts for the document workspace at /new-screen. */

export type DocumentKind = "pdf" | "image";

export interface SourceDocument {
  name: string;
  sizeBytes: number;
  contentType: string;
  kind: DocumentKind;
  /** Object URL for the local preview. Revoked when the document is replaced. */
  previewUrl: string;
}

/** Progress through upload, OCR, and report generation. */
export type WorkspacePhase =
  | "idle"
  | "uploading"
  | "extracting"
  | "composing"
  | "ready"
  | "error";

export interface WorkspaceState {
  phase: WorkspacePhase;
  document: SourceDocument | null;
  /** 0 to 1 while uploading. */
  progress: number;
  /** Markdown returned by OCR. */
  extracted: string;
  /** The structured report, English source of truth. */
  report: string;
  pageCount: number;
  message: string | null;
}

export interface ExtractionStartResponse {
  jobId: string;
  name: string;
  sizeBytes: number;
  contentType: string;
  kind: DocumentKind;
}

export interface ExtractionStatusResponse {
  jobId: string;
  phase: "queued" | "reading" | "done" | "failed";
  markdown?: string;
  pageCount?: number;
  message?: string;
}

export interface TranslateResponse {
  language: TranslatableLanguage;
  markdown: string;
}

/** Flags the report table may carry, in the order they escalate. */
export const RESULT_FLAGS = ["Normal", "Borderline", "Low", "High", "Critical"] as const;
export type ResultFlag = (typeof RESULT_FLAGS)[number];
