import { randomUUID } from "node:crypto";

import { MAX_REPORT_BYTES, validateReport } from "@/lib/files";
import { fail, json } from "@/lib/http";
import type { ReportIntakeResponse } from "@/types/composer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Enough context for the model without shipping a whole booklet. */
const MAX_EXCERPT_CHARS = 12_000;

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

  if (check.kind === "image") {
    // Photographs are read by the vision model at question time.
    return json<ReportIntakeResponse>({ ...base, excerpt: "", needsVision: true });
  }

  try {
    const { extractText, getDocumentProxy } = await import("unpdf");
    const bytes = new Uint8Array(await file.arrayBuffer());
    const pdf = await getDocumentProxy(bytes);
    const { text } = await extractText(pdf, { mergePages: true });

    const excerpt = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

    return json<ReportIntakeResponse>({
      ...base,
      excerpt: excerpt.slice(0, MAX_EXCERPT_CHARS),
      // A scanned PDF has no text layer, so it needs the vision model too.
      needsVision: excerpt.length < 40,
    });
  } catch {
    return fail("That PDF could not be opened. Try exporting it again.", 422);
  }
}
