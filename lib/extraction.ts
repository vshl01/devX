import "server-only";

import { unzipSync } from "fflate";

import {
  createDocAiJob,
  fetchDocAiArchive,
  getDocAiDownloadUrls,
  getDocAiJobStatus,
  getDocAiUploadUrls,
  putToUploadUrl,
  startDocAiJob,
} from "@/lib/sarvam";
import { SarvamError, type DocAiJobState, type SarvamLanguageCode } from "@/types/sarvam";

/**
 * Document extraction on top of Sarvam Document AI (Sarvam Vision). It reads
 * printed reports, scans and photographs of handwritten prescriptions, and
 * returns Markdown with the layout and tables preserved.
 *
 * The job is asynchronous, so the flow is split: `beginExtraction` uploads and
 * starts, `pollExtraction` reports progress and returns the Markdown when the
 * job finishes.
 */

/**
 * Doc AI decides what it will read from the filename extension, and it accepts
 * exactly these. It rejects anything else at upload time, including WebP and
 * HEIC, so the extension is derived from the content type here rather than
 * trusted from whatever the browser happened to call the file.
 */
const UPLOAD_EXTENSION: Record<string, string> = {
  "application/pdf": "pdf",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
};

export type ExtractionPhase = "queued" | "reading" | "done" | "failed";

export interface ExtractionProgress {
  jobId: string;
  phase: ExtractionPhase;
  /** Present once the phase is `done`. */
  markdown?: string;
  pageCount?: number;
  message?: string;
}

/**
 * Builds the name Sarvam sees. The stem is sanitised for the blob store and the
 * extension always comes from the content type, so a file called "scan" or
 * "photo.HEIC" cannot be rejected for the wrong reason.
 */
function uploadName(originalName: string, mimeType: string): string {
  const extension = UPLOAD_EXTENSION[mimeType];
  if (!extension) {
    throw new SarvamError(
      "unsupported_input",
      "Sarvam reads PDF, JPG and PNG. Convert this file and try again.",
      415,
    );
  }

  const stem = originalName
    .replace(/\.[^.]*$/, "")
    .replace(/[^\w\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60);

  return `${stem.length > 0 ? stem : "document"}.${extension}`;
}

export interface BeginExtractionInput {
  name: string;
  type: string;
  bytes: Uint8Array;
  language?: SarvamLanguageCode;
}

/** Uploads the document and starts the Sarvam job. Returns its id. */
export async function beginExtraction({
  name,
  type,
  bytes,
  language = "en-IN",
}: BeginExtractionInput): Promise<{ jobId: string }> {
  // Validated before a job is created, so a bad file costs nothing upstream.
  const filename = uploadName(name, type);

  const job = await createDocAiJob({ language, output_format: "md" });
  const links = await getDocAiUploadUrls(job.job_id, [filename]);
  const target = links.upload_urls?.[filename]?.file_url;
  if (!target) {
    throw new SarvamError("upstream_error", "Sarvam did not return an upload target.");
  }

  await putToUploadUrl(
    target,
    bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
  );
  await startDocAiJob(job.job_id);

  return { jobId: job.job_id };
}

const TERMINAL: DocAiJobState[] = ["Completed", "PartiallyCompleted", "Failed"];

/** Checks a job once. Callers poll this rather than blocking a request. */
export async function pollExtraction(jobId: string): Promise<ExtractionProgress> {
  const status = await getDocAiJobStatus(jobId);

  if (!TERMINAL.includes(status.job_state)) {
    return {
      jobId,
      phase: status.job_state === "Running" ? "reading" : "queued",
    };
  }

  if (status.job_state === "Failed") {
    return {
      jobId,
      phase: "failed",
      message:
        status.error_message ??
        "Sarvam could not read this document. Try a clearer scan or photo.",
    };
  }

  const links = await getDocAiDownloadUrls(jobId);
  const archiveUrl = Object.values(links.download_urls ?? {})[0]?.file_url;
  if (!archiveUrl) {
    return { jobId, phase: "failed", message: "The extracted document was not available." };
  }

  const archive = await fetchDocAiArchive(archiveUrl);
  const files = unzipSync(archive);

  const markdownEntry = Object.keys(files).find((entry) => entry.endsWith(".md"));
  if (!markdownEntry) {
    return { jobId, phase: "failed", message: "The extraction returned no readable text." };
  }

  const markdown = new TextDecoder().decode(files[markdownEntry]).trim();
  const pageCount = Object.keys(files).filter((entry) => /page_\d+\.json$/.test(entry)).length;

  if (!markdown) {
    return {
      jobId,
      phase: "failed",
      message: "No text was found in this document. Try a sharper photo.",
    };
  }

  return { jobId, phase: "done", markdown, pageCount: pageCount || 1 };
}

/**
 * Blocking convenience wrapper for callers that cannot poll from the browser,
 * such as the landing page composer. Bounded so a request cannot hang.
 */
export async function extractDocumentText(
  input: BeginExtractionInput & { timeoutMs?: number },
): Promise<{ markdown: string; pageCount: number }> {
  const { jobId } = await beginExtraction(input);
  const deadline = Date.now() + (input.timeoutMs ?? 90_000);

  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 2_000));
    const progress = await pollExtraction(jobId);

    if (progress.phase === "done") {
      return { markdown: progress.markdown ?? "", pageCount: progress.pageCount ?? 1 };
    }
    if (progress.phase === "failed") {
      throw new SarvamError("unsupported_input", progress.message ?? "Unreadable document.", 422);
    }
  }

  throw new SarvamError("network_error", "Reading the document timed out.", 504);
}
