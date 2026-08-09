import { beginExtraction } from "@/lib/extraction";
import { ensureSession, recordDocument } from "@/lib/sessions";
import { ACCEPTED_DOCUMENT_TYPES, MAX_DOCUMENT_BYTES, validateDocument } from "@/lib/documents";
import { fail, json } from "@/lib/http";
import { SarvamError, type SarvamLanguageCode } from "@/types/sarvam";
import type { ExtractionStartResponse } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Uploads a document to Sarvam Document AI and starts the digitisation job.
 * The browser then polls `/api/extract/[jobId]`. Splitting it this way keeps
 * the upload request short enough to report real progress.
 */
export async function POST(request: Request) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return fail("Expected a document.", 400);
  }

  const file = form.get("document");
  if (!(file instanceof File)) {
    return fail("Expected a document.", 400);
  }

  const check = validateDocument(file);
  if (!check.ok) {
    return fail(check.message, 415);
  }
  if (file.size > MAX_DOCUMENT_BYTES) {
    return fail("That file is over 20 MB.", 413);
  }

  const language = (form.get("language") as SarvamLanguageCode | null) ?? "en-IN";
  const sessionId = (form.get("sessionId") as string | null)?.trim();
  if (!sessionId) return fail("Missing session id.", 400);

  const bytes = new Uint8Array(await file.arrayBuffer());

  try {
    const { jobId } = await beginExtraction({
      name: file.name,
      type: file.type,
      bytes,
      language,
    });

    await ensureSession(sessionId, language);
    await recordDocument({
      sessionId,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      kind: check.kind,
      sarvamJobId: jobId,
      bytes,
    });

    return json<ExtractionStartResponse>({
      jobId,
      name: file.name,
      sizeBytes: file.size,
      contentType: file.type,
      kind: check.kind,
    });
  } catch (cause) {
    if (cause instanceof SarvamError) {
      // The upstream detail never reaches the browser, so it goes to the log.
      console.error("[extract] sarvam rejected the upload", {
        code: cause.code,
        detail: cause.message,
        file: { name: file.name, type: file.type, size: file.size },
      });
      return fail(messageFor(cause), cause.status, cause.code);
    }
    console.error("[extract] unexpected failure", cause);
    return fail("The document could not be sent for reading.", 500);
  }
}

export function GET() {
  return json({ accepts: ACCEPTED_DOCUMENT_TYPES, maxBytes: MAX_DOCUMENT_BYTES });
}

function messageFor(error: SarvamError): string {
  switch (error.code) {
    case "missing_key":
      return "Document reading is not configured on this deployment.";
    case "rate_limited":
      return "Too many documents right now. Try again in a moment.";
    case "network_error":
      return "Could not reach the document reader.";
    case "unsupported_input":
      return error.message;
    case "unauthorized":
      return "The document reader rejected this deployment's API key.";
    default:
      return "The document could not be sent for reading.";
  }
}
