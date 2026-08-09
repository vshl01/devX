import type { ReportKind } from "@/types/composer";

/** Upload rules shared by the client control and the route handler. */

export const MAX_REPORT_BYTES = 20 * 1024 * 1024;

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
] as const;

export const ACCEPT_ATTRIBUTE = ".pdf,.png,.jpg,.jpeg,.webp,.heic";

export function reportKind(mimeType: string): ReportKind | null {
  if (mimeType === "application/pdf") return "pdf";
  if (mimeType.startsWith("image/")) return "image";
  return null;
}

export function validateReport(file: {
  type: string;
  size: number;
  name: string;
}): { ok: true; kind: ReportKind } | { ok: false; message: string } {
  const kind = reportKind(file.type);
  const accepted = (ACCEPTED_MIME_TYPES as readonly string[]).includes(file.type);

  if (!kind || !accepted) {
    return { ok: false, message: "Upload a PDF or a photo of the report." };
  }
  if (file.size === 0) {
    return { ok: false, message: "That file is empty." };
  }
  if (file.size > MAX_REPORT_BYTES) {
    return { ok: false, message: "That file is over 20 MB." };
  }
  return { ok: true, kind };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
