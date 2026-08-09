import type { DocumentKind } from "@/types/workspace";

/** Intake rules for the workspace, shared by the dropzone and the route handler. */

export const MAX_DOCUMENT_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_DOCUMENT_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const DOCUMENT_ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,.heic,.heif";

export function documentKind(mimeType: string): DocumentKind | null {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

export function validateDocument(file: { type: string; size: number; name: string }):
  | { ok: true; kind: DocumentKind }
  | { ok: false; message: string } {
  const kind = documentKind(file.type);
  const accepted = (ACCEPTED_DOCUMENT_TYPES as readonly string[]).includes(file.type);

  if (!kind || !accepted) {
    return {
      ok: false,
      message: "Upload a PDF, or a JPG, PNG or HEIC photo of the document.",
    };
  }
  if (file.size === 0) return { ok: false, message: "That file is empty." };
  if (file.size > MAX_DOCUMENT_BYTES) return { ok: false, message: "That file is over 20 MB." };

  return { ok: true, kind };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Short, human label for the file chip. */
export function documentTypeLabel(mimeType: string): string {
  if (mimeType === "application/pdf") return "PDF";
  const subtype = mimeType.split("/")[1] ?? "file";
  return subtype.replace("jpeg", "jpg").toUpperCase();
}
