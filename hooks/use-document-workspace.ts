"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { validateDocument } from "@/lib/documents";
import { toReadableDocument, UnreadableImageError } from "@/lib/image-convert";
import type { SessionSnapshot } from "@/types/conversation";
import type {
  ExtractionStartResponse,
  ExtractionStatusResponse,
  SourceDocument,
  WorkspaceState,
} from "@/types/workspace";

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS = 180_000;

const IDLE: WorkspaceState = {
  phase: "idle",
  document: null,
  progress: 0,
  extracted: "",
  report: "",
  pageCount: 0,
  message: null,
};

export interface UseDocumentWorkspace extends WorkspaceState {
  select: (file: File) => void;
  reset: () => void;
  retry: () => void;
}

export interface UseDocumentWorkspaceOptions {
  /** Null until the session has been opened; uploads wait for it. */
  sessionId: string | null;
  /** Restored state for a session that already held a document. */
  snapshot: SessionSnapshot | null;
}

/** Rebuilds workspace state from a persisted session. */
function fromSnapshot(snapshot: SessionSnapshot): WorkspaceState {
  const { document, extraction } = snapshot;
  if (!document || !extraction) return IDLE;

  return {
    phase: extraction.report ? "ready" : "error",
    document: {
      name: document.fileName,
      sizeBytes: document.sizeBytes,
      contentType: document.mimeType,
      kind: document.kind,
      previewUrl: `/api/documents/${document.id}/file`,
    },
    progress: 1,
    extracted: extraction.markdown,
    report: extraction.report ?? "",
    pageCount: extraction.pageCount,
    message: extraction.report ? null : "The reading of this document did not finish. Upload it again.",
  };
}

/**
 * Drives one document from selection to finished report:
 * upload with progress, poll Sarvam Document AI, then stream the structured
 * report. Every stage is cancellable, and replacing the file cancels the last.
 */
export function useDocumentWorkspace({
  sessionId,
  snapshot,
}: UseDocumentWorkspaceOptions): UseDocumentWorkspace {
  const [state, setState] = useState<WorkspaceState>(IDLE);

  const requestRef = useRef<XMLHttpRequest | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const previewRef = useRef<string | null>(null);
  const lastFileRef = useRef<File | null>(null);

  const cancel = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    abortRef.current?.abort();
    abortRef.current = null;
  }, []);

  const releasePreview = useCallback(() => {
    if (previewRef.current) URL.revokeObjectURL(previewRef.current);
    previewRef.current = null;
  }, []);

  const reset = useCallback(() => {
    cancel();
    releasePreview();
    lastFileRef.current = null;
    setState(IDLE);
  }, [cancel, releasePreview]);

  /** Streams the structured report once OCR text is in hand. */
  // A restored session repopulates both panes exactly once.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current || !snapshot?.document) return;
    hydratedRef.current = true;
    setState(fromSnapshot(snapshot));
  }, [snapshot]);

  const sessionRef = useRef(sessionId);
  useEffect(() => {
    sessionRef.current = sessionId;
  }, [sessionId]);

  const compose = useCallback(async (text: string) => {
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({ text, sessionId: sessionRef.current }),
      });

      if (!response.ok || !response.body) {
        const payload = (await response.json().catch(() => null)) as { error?: string } | null;
        setState((current) => ({
          ...current,
          phase: "error",
          message: payload?.error ?? "The report could not be written.",
        }));
        return;
      }

      const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
      let report = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        report += value;
        setState((current) => ({ ...current, phase: "composing", report }));
      }

      setState((current) =>
        report.trim()
          ? { ...current, phase: "ready", report }
          : {
              ...current,
              phase: "error",
              message: "The reader returned an empty report. Try again.",
            },
      );
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      setState((current) => ({
        ...current,
        phase: "error",
        message: "Lost connection while writing the report.",
      }));
    }
  }, []);

  /** Polls the digitisation job until Sarvam has read every page. */
  const waitForExtraction = useCallback(
    async (jobId: string) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const deadline = Date.now() + POLL_TIMEOUT_MS;

      while (Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        if (controller.signal.aborted) return;

        let status: ExtractionStatusResponse & { error?: string };
        try {
          const response = await fetch(`/api/extract/${jobId}`, { signal: controller.signal });
          status = (await response.json()) as typeof status;
          if (!response.ok) {
            setState((current) => ({
              ...current,
              phase: "error",
              message: status.error ?? "The document could not be read.",
            }));
            return;
          }
        } catch (error) {
          if ((error as Error).name === "AbortError") return;
          setState((current) => ({
            ...current,
            phase: "error",
            message: "Lost contact with the document reader.",
          }));
          return;
        }

        if (status.phase === "failed") {
          setState((current) => ({
            ...current,
            phase: "error",
            message: status.message ?? "The document could not be read.",
          }));
          return;
        }

        if (status.phase === "done" && status.markdown) {
          setState((current) => ({
            ...current,
            phase: "composing",
            extracted: status.markdown ?? "",
            pageCount: status.pageCount ?? 1,
          }));
          await compose(status.markdown);
          return;
        }
      }

      setState((current) => ({
        ...current,
        phase: "error",
        message: "Reading this document took too long. Try a smaller file.",
      }));
    },
    [compose],
  );

  const upload = useCallback(
    (file: File, preview: SourceDocument) => {
      setState({ ...IDLE, phase: "uploading", document: preview });

      const form = new FormData();
      form.append("document", file);
      form.append("language", "en-IN");
      form.append("sessionId", sessionRef.current ?? "");

      const request = new XMLHttpRequest();
      requestRef.current = request;
      request.open("POST", "/api/extract");
      request.responseType = "json";

      request.upload.addEventListener("progress", (event) => {
        if (!event.lengthComputable) return;
        const progress = event.loaded / event.total;
        setState((current) =>
          progress >= 1
            ? { ...current, phase: "extracting", progress: 1 }
            : { ...current, phase: "uploading", progress },
        );
      });

      request.addEventListener("load", () => {
        requestRef.current = null;
        const payload = request.response as ExtractionStartResponse & { error?: string };

        if (request.status >= 400 || !payload?.jobId) {
          setState((current) => ({
            ...current,
            phase: "error",
            message: payload?.error ?? "The document could not be uploaded.",
          }));
          return;
        }

        setState((current) => ({ ...current, phase: "extracting", progress: 1 }));
        void waitForExtraction(payload.jobId);
      });

      request.addEventListener("error", () => {
        requestRef.current = null;
        setState((current) => ({
          ...current,
          phase: "error",
          message: "The upload failed. Check your connection and try again.",
        }));
      });

      request.send(form);
    },
    [waitForExtraction],
  );

  const select = useCallback(
    (file: File) => {
      cancel();
      releasePreview();

      if (!sessionRef.current) {
        setState({ ...IDLE, phase: "error", message: "Still opening your session. Try again in a moment." });
        return;
      }

      const check = validateDocument(file);
      if (!check.ok) {
        lastFileRef.current = null;
        setState({ ...IDLE, phase: "error", message: check.message });
        return;
      }

      lastFileRef.current = file;

      // The preview shows the original; Sarvam gets a format it can read.
      const previewUrl = URL.createObjectURL(file);
      previewRef.current = previewUrl;

      setState({
        ...IDLE,
        phase: "uploading",
        document: {
          name: file.name,
          sizeBytes: file.size,
          contentType: file.type,
          kind: check.kind,
          previewUrl,
        },
      });

      void toReadableDocument(file)
        .then((readable) =>
          upload(readable, {
            name: file.name,
            sizeBytes: file.size,
            contentType: file.type,
            kind: check.kind,
            previewUrl,
          }),
        )
        .catch((cause) => {
          setState((current) => ({
            ...current,
            phase: "error",
            message:
              cause instanceof UnreadableImageError
                ? cause.message
                : "That file could not be prepared for reading.",
          }));
        });
    },
    [cancel, releasePreview, upload],
  );

  const retry = useCallback(() => {
    const file = lastFileRef.current;
    if (file) select(file);
  }, [select]);

  useEffect(
    () => () => {
      cancel();
      releasePreview();
    },
    [cancel, releasePreview],
  );

  return { ...state, select, reset, retry };
}
