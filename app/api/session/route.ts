import { fail, json } from "@/lib/http";
import { isTranslatableLanguage } from "@/lib/languages";
import { createSession, loadSnapshot, setSessionLanguage } from "@/lib/sessions";
import type { SessionSnapshot } from "@/types/conversation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Restores a session, or reports that it is gone so the client starts fresh. */
export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id) return fail("Missing session id.", 400);

  const snapshot = await loadSnapshot(id);
  if (!snapshot) return fail("No such session.", 404);

  return json<SessionSnapshot>(snapshot);
}

/** Opens a session, or updates the language of one that already exists. */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    language?: string;
  };

  const language = isTranslatableLanguage(body.language ?? "") ? body.language! : "en-IN";

  if (body.id) {
    await setSessionLanguage(body.id, language);
    return json({ sessionId: body.id, language });
  }

  const sessionId = await createSession(language);
  return json({ sessionId, language });
}
