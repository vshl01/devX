import "server-only";

import { unzipSync, zipSync } from "fflate";

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

/** Doc AI takes one PDF, or one ZIP of JPEG/PNG images. */
const PDF_MIME = "application/pdf";

export type ExtractionPhase = "queued" | "reading" | "done" | "failed";

export interface ExtractionProgress {
  jobId: string;
  phase: ExtractionPhase;
  /** Present once the phase is `done`. */
  markdown?: string;
  pageCount?: number;
  message?: string;
}

function safeName(name: string, fallback: string): string {
  const cleaned = name
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "_")
    .slice(-80);
  return cleaned.length > 3 ? cleaned : fallback;
}

/**
 * Doc AI accepts PDFs directly. Anything else (JPEG, PNG, HEIC photos of a
 * prescription) is wrapped in a single-entry ZIP, which is the archive shape
 * the API documents.
 */
function toUploadPayload(
  file: { name: string; type: string },
  bytes: Uint8Array,
): { filename: string; body: Uint8Array } {
  if (file.type === PDF_MIME) {
    return { filename: safeName(file.name, "document.pdf"), body: bytes };
  }

  const extension = file.type.includes("png")
    ? "png"
    : file.type.includes("webp")
      ? "webp"
      : "jpg";
  const inner = safeName(file.name, `page.${extension}`);
  const zipped = zipSync({ [inner]: bytes }, { level: 0 });
  return { filename: "pages.zip", body: zipped };
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
  const job = await createDocAiJob({ language, output_format: "md" });
  const { filename, body } = toUploadPayload({ name, type }, bytes);

  const links = await getDocAiUploadUrls(job.job_id, [filename]);
  const target = links.upload_urls?.[filename]?.file_url;
  if (!target) {
    throw new SarvamError("upstream_error", "Sarvam did not return an upload target.");
  }

  await putToUploadUrl(
    target,
    body.buffer.slice(body.byteOffset, body.byteOffset + body.byteLength) as ArrayBuffer,
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
