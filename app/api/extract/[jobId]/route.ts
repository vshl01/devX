import { pollExtraction } from "@/lib/extraction";
import { fail, json } from "@/lib/http";
import { SarvamError } from "@/types/sarvam";
import type { ExtractionStatusResponse } from "@/types/workspace";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One poll of a Sarvam digitisation job. Returns the Markdown once it is done. */
export async function GET(_request: Request, context: RouteContext<"/api/extract/[jobId]">) {
  const { jobId } = await context.params;
  if (!jobId) return fail("Missing job id.", 400);

  try {
    const progress = await pollExtraction(jobId);
    return json<ExtractionStatusResponse>(progress);
  } catch (cause) {
    if (cause instanceof SarvamError) {
      return fail(
        cause.code === "network_error"
          ? "Lost contact with the document reader."
          : "The document could not be read.",
        cause.status,
        cause.code,
      );
    }
    return fail("The document could not be read.", 500);
  }
}
