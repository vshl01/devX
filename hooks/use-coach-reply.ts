"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { AttachedReport, ReplyState } from "@/types/composer";

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

export interface AskInput {
  question: string;
  report: AttachedReport | null;
  /** The original file, needed when the report is a photo. */
  file: File | null;
}

export interface UseCoachReply {
  reply: ReplyState;
  ask: (input: AskInput) => Promise<void>;
  reset: () => void;
}

/** Sends the composer contents to `/api/chat` and streams the answer back. */
export function useCoachReply(): UseCoachReply {
  const [reply, setReply] = useState<ReplyState>({ status: "idle" });
  const controllerRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setReply({ status: "idle" });
  }, []);

  const ask = useCallback(async ({ question, report, file }: AskInput) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setReply({ status: "streaming", text: "" });

    try {
      let imageDataUrl: string | undefined;
      if (report?.needsVision && file) {
        imageDataUrl = await readAsDataUrl(file);
      }

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          question,
          report: report
            ? { name: report.name, excerpt: report.excerpt, imageDataUrl }
            : undefined,
        }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setReply({
          status: "error",
          message: payload?.error ?? "The coach could not answer just now.",
        });
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let text = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        text += value;
        setReply({ status: "streaming", text });
      }

      setReply(
        text.trim()
          ? { status: "done", text }
          : { status: "error", message: "The coach returned an empty answer. Try rephrasing." },
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setReply({ status: "error", message: "Lost connection to the assistant." });
    } finally {
      if (controllerRef.current === controller) controllerRef.current = null;
    }
  }, []);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { reply, ask, reset };
}
