import { fail } from "@/lib/http";
import { loadMessageAudio } from "@/lib/sessions";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Replays a whole spoken turn, its chunks joined back into one file. */
export async function GET(_request: Request, context: RouteContext<"/api/audio/[messageId]">) {
  const { messageId } = await context.params;
  if (!messageId) return fail("Missing message id.", 400);

  const clip = await loadMessageAudio(messageId);
  if (!clip) return fail("No audio for that message.", 404);

  return new Response(new Uint8Array(clip.bytes), {
    headers: {
      "Content-Type": clip.mimeType,
      "Content-Length": String(clip.bytes.byteLength),
      "Cache-Control": "private, max-age=3600",
    },
  });
}
