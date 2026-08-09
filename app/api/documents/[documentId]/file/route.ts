import { fail } from "@/lib/http";
import { loadDocumentFile } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Serves the stored original so a reopened session can preview it again. */
export async function GET(
  _request: Request,
  context: RouteContext<"/api/documents/[documentId]/file">,
) {
  const { documentId } = await context.params;
  if (!documentId) return fail("Missing document id.", 400);

  const file = await loadDocumentFile(documentId);
  if (!file) return fail("That document is no longer stored.", 404);

  return new Response(new Uint8Array(file.bytes), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.fileName)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
