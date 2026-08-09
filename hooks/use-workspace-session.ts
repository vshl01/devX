"use client";

import { useEffect, useState } from "react";

import type { SessionSnapshot } from "@/types/conversation";

const STORAGE_KEY = "lucid.session";

export interface UseWorkspaceSession {
  sessionId: string | null;
  /** What was already in this session, or null for a fresh one. */
  snapshot: SessionSnapshot | null;
  restoring: boolean;
}

/**
 * Ties the browser to one durable session. The id lives in local storage, so a
 * reload restores the document and the whole transcript from Postgres.
 */
export function useWorkspaceSession(): UseWorkspaceSession {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<SessionSnapshot | null>(null);
  const [restoring, setRestoring] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      const stored = window.localStorage.getItem(STORAGE_KEY);

      if (stored) {
        try {
          const response = await fetch(`/api/session?id=${encodeURIComponent(stored)}`);
          if (response.ok) {
            const restored = (await response.json()) as SessionSnapshot;
            if (cancelled) return;
            setSessionId(restored.sessionId);
            setSnapshot(restored);
            setRestoring(false);
            return;
          }
        } catch {
          // Fall through and open a new session.
        }
      }

      try {
        const response = await fetch("/api/session", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const created = (await response.json()) as { sessionId?: string };
        if (cancelled || !created.sessionId) return;
        window.localStorage.setItem(STORAGE_KEY, created.sessionId);
        setSessionId(created.sessionId);
      } catch {
        // Without a session the workspace still reads documents, it just
        // cannot remember them. Surfaced by the pane, not thrown here.
      } finally {
        if (!cancelled) setRestoring(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { sessionId, snapshot, restoring };
}
