/** Shared UI state contracts for the hero composer. */

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "transcribing"
  | "denied"
  | "unsupported"
  | "error";

export type ReportKind = "pdf" | "image";

/** A medical report the user attached, after the server accepted it. */
export interface AttachedReport {
  id: string;
  name: string;
  sizeBytes: number;
  kind: ReportKind;
  /** Plain text pulled out of a PDF, empty for images (read at answer time). */
  excerpt: string;
  /** True when the file still needs to be read by the vision model. */
  needsVision: boolean;
}

export type UploadState =
  | { status: "idle" }
  | { status: "uploading"; name: string; sizeBytes: number; progress: number }
  | { status: "reading"; name: string; sizeBytes: number }
  | { status: "ready"; report: AttachedReport }
  | { status: "error"; name: string; message: string };

export type ReplyState =
  | { status: "idle" }
  | { status: "streaming"; text: string }
  | { status: "done"; text: string }
  | { status: "error"; message: string };

/** Shape returned by `POST /api/reports`. */
export interface ReportIntakeResponse {
  id: string;
  name: string;
  sizeBytes: number;
  kind: ReportKind;
  excerpt: string;
  needsVision: boolean;
}

/** Shape returned by `POST /api/stt`. */
export interface TranscribeResponse {
  transcript: string;
  languageCode: string | null;
}

/** Error envelope every route handler returns on failure. */
export interface ApiErrorResponse {
  error: string;
  code?: string;
}
