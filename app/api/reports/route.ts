import { randomUUID } from "node:crypto";

import { extractDocumentText } from "@/lib/extraction";
import { MAX_REPORT_BYTES, validateReport } from "@/lib/files";
import { fail, json } from "@/lib/http";
import type { ReportIntakeResponse } from "@/types/composer";
import { SarvamError } from "@/types/sarvam";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enough context for the model without shipping a whole booklet. */
const MAX_EXCERPT_CHARS = 12_000;
/** The composer waits inline, so OCR here is bounded far tighter than the workspace. */
const OCR_TIMEOUT_MS = 75_000;

/**
 * Report intake. Validates the upload and, for PDFs, pulls the text out so the
 * coach can read it. Nothing is written to disk: the excerpt goes back to the
 * browser and travels with the next question.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Expected a file.", 400);
  }

  const file = form.get("report");
  if (!(file instanceof File)) {
    return fail("Expected a file.", 400);
  }

  const check = validateReport(file);
  if (!check.ok) {
    return fail(check.message, 415);
  }
  if (file.size > MAX_REPORT_BYTES) {
    return fail("That file is over 20 MB.", 413);
  }

  const base = {
    id: randomUUID(),
    name: file.name,
    sizeBytes: file.size,
    kind: check.kind,
  };

  const bytes = new Uint8Array(await file.arrayBuffer());

  // A text-layer PDF is readable instantly and for free.
  if (check.kind === "pdf") {
    try {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(bytes);
      const { text } = await extractText(pdf, { mergePages: true });
      const excerpt = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

      if (excerpt.length >= 40) {
        return json<ReportIntakeResponse>({
          ...base,
          excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
          needsVision: false,
        });
      }
    } catch {
      return fail("That PDF could not be opened. Try exporting it again.", 422);
    }
  }

  // Photographs and scans go through Sarvam Document AI, the same reader the
  // workspace at /new-screen uses.
  try {
    const ocr = await extractDocumentText({
      name: file.name,
      type: file.type,
      bytes,
      timeoutMs: OCR_TIMEOUT_MS,
    });

    return json<ReportIntakeResponse>({
      ...base,
      excerpt: ocr.markdown.slice(0, MAX_EXCERPT_CHARS),
      needsVision: false,
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail("That document could not be read. Try a sharper photo.", cause.status, cause.code);
    }
    return fail(
      "Reading that scan took too long. Try the workspace at /new-screen for large documents.",
      504,
    );
  }
}
